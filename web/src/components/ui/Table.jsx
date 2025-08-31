import React, { forwardRef } from 'react';
import { useTheme } from '../../lib/theme';

export function Table({ className = '', children }) {
  return (
    <div className={`overflow-x-auto border rounded-md ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-gray-900 dark:text-gray-100">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-800/80">
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ density, children }) {
  const { density: pref } = useTheme();
  const den = density || pref || 'comfort';
  const rowPad = den === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2';
  return <tbody className={`bg-white dark:bg-gray-900/40 divide-y divide-gray-200 dark:divide-gray-800 [&>tr>td]:${rowPad}`}>{children}</tbody>;
}

export function Th({ children, align = 'left' }) {
  return (
    <th className={`px-3 py-2 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider`}>{children}</th>
  );
}

export const Tr = forwardRef(function Tr({ children, hover = true, className = '' }, ref) {
  return <tr ref={ref} className={`${hover ? 'hover:bg-gray-50 dark:hover:bg-gray-900/40' : ''} ${className}`}>{children}</tr>;
});

export function Td({ children, align = 'left', mono = false }) {
  return <td className={`px-3 py-2 text-${align} ${mono ? 'font-mono' : ''}`}>{children}</td>;
}
