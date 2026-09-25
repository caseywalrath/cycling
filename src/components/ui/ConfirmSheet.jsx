import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import Button from './Button.jsx';

// ConfirmSheet + useConfirm() — promise-based replacement for window.confirm().
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Delete ride?', message: '…', confirmLabel: 'Delete', destructive: true })) { … }
// Resolves true on confirm, false on cancel / backdrop tap.
const ConfirmContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm() must be used inside <ConfirmProvider>');
  return ctx;
}

export function ConfirmSheet({ open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel }) {
  return (
    <Sheet open={open} onClose={onCancel} title={title} closeLabel="" zIndex={60}>
      {message && <div className="text-base text-gray-300 whitespace-pre-line mb-5">{message}</div>}
      <div className="flex flex-col gap-2">
        <Button variant={destructive ? 'destructive' : 'primary'} block onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="secondary" block onClick={onCancel}>{cancelLabel}</Button>
      </div>
    </Sheet>
  );
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    if (resolver.current) resolver.current(false);
    resolver.current = resolve;
    setRequest(options || {});
  }), []);

  const finish = (answer) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    if (resolve) resolve(answer);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmSheet
        open={!!request}
        {...(request || {})}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmContext.Provider>
  );
}
