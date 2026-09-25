import React from 'react';

// SectionHeader — title (16px semibold), optional subtitle, optional right-side action.
export default function SectionHeader({ title, subtitle, right, className = '', as: Tag = 'h2' }) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-3 ${className}`}>
      <div className="min-w-0">
        <Tag className="text-base font-semibold text-white">{title}</Tag>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
