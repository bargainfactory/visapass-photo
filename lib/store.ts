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
  brightness: number;
  contrast: number;
  /** Recently completed Stripe orders for the current user (kept lightweight). */
  orders: OrderRecord[];
  /** Last face detection confidence (0–1). */
  faceConfidence: number | null;
  setStep: (s: WizardStep) => void;
  setSource: (url: string | null, mime: string | null) => void;
  setDocument: (id: string | null) => void;
  setResult: (dataUrl: string | null, sheetUrl?: string | null) => void;
  setAdjustments: (b: number, c: number) => void;
  setFaceConfidence: (c: number | null) => void;
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
      brightness: 0,
      contrast: 0,
      orders: [],
      faceConfidence: null,
      setStep: (step) => set({ step }),
      setSource: (sourceUrl, sourceMime) => set({ sourceUrl, sourceMime }),
      setDocument: (documentId) => set({ documentId }),
      setResult: (resultDataUrl, sheetUrl) =>
        set({ resultDataUrl, printSheetDataUrl: sheetUrl ?? null }),
      setAdjustments: (brightness, contrast) => set({ brightness, contrast }),
      setFaceConfidence: (faceConfidence) => set({ faceConfidence }),
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
          brightness: 0,
          contrast: 0,
          faceConfidence: null,
        }),
    }),
    {
      name: 'visapass-photo',
      storage: createJSONStorage(() => localStorage),
      // Don't persist large blob URLs / data URLs — they bloat localStorage.
      partialize: (s) => ({ documentId: s.documentId, orders: s.orders, step: s.step }),
    }
  )
);
