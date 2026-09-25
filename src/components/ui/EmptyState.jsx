import React from 'react';
import Button from './Button.jsx';

// EmptyState — icon, one sentence, optional action button.
export default function EmptyState({ icon, message, actionLabel, onAction, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center gap-3 py-8 px-4 ${className}`}>
      {icon && <div className="text-gray-500" aria-hidden="true">{icon}</div>}
      <p className="text-base text-gray-400">{message}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
