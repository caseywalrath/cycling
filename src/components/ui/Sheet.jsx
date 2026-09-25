import React, { useEffect } from 'react';

// Sheet — bottom sheet for forms and short readouts. Slides up, rounded top, drag handle,
// max height 92vh with its own scroll, optional sticky footer for the primary button.
// Closes on backdrop tap or the Cancel/Close button (onClose).
let openSheets = 0;

export default function Sheet({ open, onClose, title, footer, children, closeLabel = 'Cancel', labelledBy, zIndex = 50 }) {
  // Lock the page behind the sheet from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    openSheets += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openSheets -= 1;
      if (openSheets <= 0) { openSheets = 0; document.body.style.overflow = ''; }
    };
  }, [open]);

  if (!open) return null;
  const titleId = labelledBy || (title ? `sheet-title-${String(title).replace(/\W+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl bg-gray-800 rounded-t-2xl shadow-2xl flex flex-col animate-sheet-up"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2 pb-1 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-gray-600" />
        </div>
        {(title || (onClose && closeLabel)) && (
          <div className="flex items-center justify-between gap-3 px-4 pb-2">
            <h2 id={titleId} className="text-lg font-semibold text-white min-w-0 truncate">{title}</h2>
            {onClose && closeLabel && (
              <button type="button" onClick={onClose} className="min-h-[44px] px-2 -mr-2 text-base text-blue-400 hover:text-blue-300 shrink-0">
                {closeLabel}
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-4 pb-4 flex-1" style={footer ? undefined : { paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
        {footer && (
          <div className="border-t border-gray-700 bg-gray-800 px-4 pt-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
