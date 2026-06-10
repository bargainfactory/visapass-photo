'use client';

/**
 * Payment-gated, privacy-preserving delivery of the final deliverables.
 *
 * THE PROBLEM. The compliant photo + print sheets are rendered entirely on the
 * device. The old flow stashed those clean, full-resolution images in
 * sessionStorage before payment and let the success page download them — so a
 * buyer could open DevTools, read sessionStorage, and save the unwatermarked
 * file without ever paying. The paywall was cosmetic.
 *
 * THE FIX (no server render, no upload, no new infra):
 *   1. When the buyer starts checkout, generate a random AES-GCM key (the DEK)
 *      and encrypt each deliverable with it. The CIPHERTEXT is stored in
 *      IndexedDB (keyed by the Stripe session id); the cleartext is discarded.
 *   2. The DEK (44 base64 chars) is handed to /api/checkout, which writes it
 *      into the Stripe Checkout Session metadata — server-only, never exposed
 *      to the browser via the client secret.
 *   3. On the success page, /api/release-key returns the DEK ONLY when Stripe
 *      confirms the session is paid. The browser then decrypts the ciphertext
 *      it already holds and offers the downloads.
 *
 * Result: the photo never leaves the device (privacy preserved), and the clean
 * file is undecryptable until Stripe says the payment cleared (enforcement).
 * The pre-payment preview is a separately-rendered, baked-watermark, downscaled
 * image (see lib/preview.ts) so nothing in the DOM is the clean deliverable.
 */

const DB_NAME = 'visapass-secure';
const STORE = 'deliverables';
const DB_VERSION = 1;

export type DeliverableKind = 'digital' | 'print' | 'printBack';

interface EncryptedItem {
  iv: Uint8Array;
  cipher: ArrayBuffer;
  mime: string;
}

export interface SecureRecord {
  sessionId: string;
  documentId: string;
  createdAt: number;
  items: Partial<Record<DeliverableKind, EncryptedItem>>;
}

/* ------------------------------- AES-GCM DEK ------------------------------ */

/** Generate a fresh 256-bit AES-GCM key; returns the live key + its base64 raw form. */
export async function generateDek(): Promise<{ key: CryptoKey; b64: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  let bin = '';
  for (const byte of raw) bin += String.fromCharCode(byte);
  return { key, b64: btoa(bin) };
}

/** Re-import a base64 DEK released by the server for decryption only. */
export async function importDek(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

async function encryptDataUrl(key: CryptoKey, dataUrl: string): Promise<EncryptedItem> {
  const { bytes, mime } = dataUrlToBytes(dataUrl);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    bytes as BufferSource
  );
  return { iv, cipher, mime };
}

/* ------------------------------- IndexedDB -------------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'sessionId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function putRecord(record: SecureRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    });
  } finally {
    db.close();
  }
}

export async function loadRecord(sessionId: string): Promise<SecureRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<SecureRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(sessionId);
      req.onsuccess = () => resolve((req.result as SecureRecord) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

export async function deleteRecord(sessionId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(sessionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // best-effort cleanup
    });
  } finally {
    db.close();
  }
}

/* ----------------------------- Public API -------------------------------- */

export interface DeliverableInput {
  digital: string;
  print?: string | null;
  printBack?: string | null;
}

/**
 * Encrypt every present deliverable with the given DEK and persist the
 * ciphertext under `sessionId`. The DEK is generated by the caller (via
 * generateDek) BEFORE the checkout request — its base64 form goes into Stripe
 * metadata, while `sessionId` (returned by checkout) keys the IndexedDB record.
 * The cleartext data URLs are not retained here.
 */
export async function storeEncrypted(
  sessionId: string,
  documentId: string,
  key: CryptoKey,
  input: DeliverableInput
): Promise<void> {
  const items: SecureRecord['items'] = {};
  items.digital = await encryptDataUrl(key, input.digital);
  if (input.print) items.print = await encryptDataUrl(key, input.print);
  if (input.printBack) items.printBack = await encryptDataUrl(key, input.printBack);
  await putRecord({ sessionId, documentId, createdAt: Date.now(), items });
}

/** Decrypt one stored deliverable back into an object URL ready for download. */
export async function decryptToObjectUrl(
  key: CryptoKey,
  item: EncryptedItem
): Promise<{ url: string; mime: string }> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: item.iv as BufferSource },
    key,
    item.cipher
  );
  const blob = new Blob([plain], { type: item.mime });
  return { url: URL.createObjectURL(blob), mime: item.mime };
}
