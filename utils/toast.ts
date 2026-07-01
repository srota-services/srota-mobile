export const TOAST_DURATION_MS = 3000;

export type ToastType = 'success' | 'error' | 'info';

export interface ToastPayload {
   message: string;
   type?: ToastType;
   durationMs?: number;
}

type ToastListener = (payload: ToastPayload) => void;

let toastListener: ToastListener | null = null;

export function registerToastListener(listener: ToastListener | null): void {
   toastListener = listener;
}

export function showToast(payload: ToastPayload): void {
   if (!toastListener) {
      if (__DEV__) {
         console.warn('[Toast] No listener registered:', payload.message);
      }
      return;
   }

   toastListener(payload);
}
