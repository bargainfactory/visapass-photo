'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WizardStep = 'upload' | 'select' | 'edit' | 'result';

export interface OrderRecord {
  id: string;
  documentId: string;
  amountCents: number;
  status: 'pending' | 'paid' | 'fulfilled' | 'shipped';
  createdAt: number;
  email?: string;
  /**
   * Per-render token attached when the order is created. The results panel
   * only treats an order as "paid" when its renderToken matches the store's
   * currentRenderToken — so a fresh upload never inherits paid status from
   * a previous purchase of the same document type.
   */
  renderToken?: string;
}

interface PhotoState {
  step: WizardStep;
  /** Object URL of the source upload — not persisted because URLs become invalid across reloads. */
  sourceUrl: string | null;
  sourceMime: string | null;
  documentId: string | null;
  /** Final composited JPEG data URL. */
  resultDataUrl: string | null;
  /** Print-ready 4-up sheet data URL. */
  printSheetDataUrl: string | null;
  /**
   * Back-of-sheet (guarantor certification) data URL — only populated for
   * documents whose spec requires it (currently Canada). null otherwise.
   */
  printSheetBackDataUrl: string | null;
  brightness: number;
  contrast: number;
  /**
   * Photoshop-style "Shadow" tone adjustment in the range -50..50.
   *   · positive = crush shadows (raise the black point)
   *   · negative = lift shadows (push dark values upward)
   * Applied as a per-pixel tone curve in the compositor *after* the
   * CSS-filter brightness/contrast pass.
   */
  shadow: number;
  /** Recently completed Stripe orders for the current user (kept lightweight). */
  orders: OrderRecord[];
  /** Last face detection confidence (0–1). */
  faceConfidence: number | null;
  /**
   * Random token regenerated on every fresh upload — scopes the paid flag
   * to *this* photo. Not persisted: a reload deliberately invalidates it
   * so users can't refresh the page and re-download an earlier purchase.
   */
  currentRenderToken: string | null;
  setStep: (s: WizardStep) => void;
  setSource: (url: string | null, mime: string | null) => void;
  setDocument: (id: string | null) => void;
  setResult: (
    dataUrl: string | null,
    sheetUrl?: string | null,
    sheetBackUrl?: string | null
  ) => void;
  setAdjustments: (b: number, c: number, s: number) => void;
  setFaceConfidence: (c: number | null) => void;
  setRenderToken: (token: string | null) => void;
  addOrder: (o: OrderRecord) => void;
  updateOrderStatus: (id: string, status: OrderRecord['status']) => void;
  reset: () => void;
}

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set) => ({
      step: 'upload',
      sourceUrl: null,
      sourceMime: null,
      documentId: null,
      resultDataUrl: null,
      printSheetDataUrl: null,
      printSheetBackDataUrl: null,
      brightness: 0,
      contrast: 0,
      shadow: 0,
      orders: [],
      faceConfidence: null,
      currentRenderToken: null,
      setStep: (step) => set({ step }),
      setSource: (sourceUrl, sourceMime) => set({ sourceUrl, sourceMime }),
      setDocument: (documentId) => set({ documentId }),
      setResult: (resultDataUrl, sheetUrl, sheetBackUrl) =>
        set({
          resultDataUrl,
          printSheetDataUrl: sheetUrl ?? null,
          printSheetBackDataUrl: sheetBackUrl ?? null,
        }),
      setAdjustments: (brightness, contrast, shadow) => set({ brightness, contrast, shadow }),
      setFaceConfidence: (faceConfidence) => set({ faceConfidence }),
      setRenderToken: (currentRenderToken) => set({ currentRenderToken }),
      addOrder: (o) => set((s) => ({ orders: [o, ...s.orders].slice(0, 20) })),
      updateOrderStatus: (id, status) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
      reset: () =>
        set({
          step: 'upload',
          sourceUrl: null,
          sourceMime: null,
          documentId: null,
          resultDataUrl: null,
          printSheetDataUrl: null,
          printSheetBackDataUrl: null,
          brightness: 0,
          contrast: 0,
          shadow: 0,
          faceConfidence: null,
          currentRenderToken: null,
        }),
    }),
    {
      name: 'visapass-photo',
      storage: createJSONStorage(() => localStorage),
      // Don't persist large blob URLs / data URLs — they bloat localStorage.
      // Also don't persist currentRenderToken: a fresh tab/reload should
      // invalidate it so a stale paid order can't be re-used.
      partialize: (s) => ({ documentId: s.documentId, orders: s.orders, step: s.step }),
    }
  )
);

/**
 * Cryptographically random token for scoping a paid order to one render.
 * Uses crypto.randomUUID where available (modern browsers) and falls back
 * to Math.random + timestamp on the small set of environments without it.
 */
export function newRenderToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
