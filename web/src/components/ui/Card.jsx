import React from 'react';

export default function Card({ as: Comp = 'div', className = '', children, padded = true, ...props }) {
  const base = `bg-white dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-[1px] ${padded ? 'p-6' : ''}`;
  return (
    <Comp className={`${base} ${className}`} {...props}>
      {children}
    </Comp>
  );
}
