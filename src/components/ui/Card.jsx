import React from 'react';

// Card — the one surface style: gray-800, rounded-2xl, 16px padding.
// Pass `as="button"` (with onClick) for a whole-card tap target.
export default function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  const tappable = Tag === 'button' || Tag === 'a';
  return (
    <Tag
      className={`block w-full text-left bg-gray-800 rounded-2xl p-4 ${tappable ? 'hover:bg-gray-700/60 active:bg-gray-700 transition-colors' : ''} ${className}`}
      {...(Tag === 'button' ? { type: 'button' } : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}
