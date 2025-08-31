import React from 'react';

export default function SectionHeader({ title, children, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 md:mb-6 ${className}`}>
      <h3 className="m-0 text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

