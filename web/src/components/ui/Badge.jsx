import React from 'react';

const variants = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-400/25 dark:text-amber-200',
  critical: 'bg-rose-100 text-rose-800 dark:bg-rose-500/25 dark:text-rose-300',
};

export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${variants[variant] || variants.neutral} ${className}`}>{children}</span>
  );
}
