import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Toast + useToast() — replaces informational alert()s (e.g. "✓ Detected: 3x8 @ 250W").
//   const toast = useToast();  toast('Saved');  toast('Sync failed', { tone: 'error' });
// One toast at a time, top of the screen below the status bar; tap to dismiss.
const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}

const TONES = {
  info: 'bg-gray-700 text-white border-gray-600',
  success: 'bg-green-800 text-white border-green-600',
  error: 'bg-red-800 text-white border-red-600',
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, { tone = 'info', duration = 3500 } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          className="fixed inset-x-0 z-[70] flex justify-center px-4 pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
        >
          <button
            key={toast.key}
            type="button"
            role="status"
            aria-live="polite"
            onClick={() => setToast(null)}
            className={`pointer-events-auto max-w-md w-full text-left rounded-xl border px-4 py-3 text-base shadow-xl animate-fade-in whitespace-pre-line ${TONES[toast.tone] || TONES.info}`}
          >
            {toast.message}
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
