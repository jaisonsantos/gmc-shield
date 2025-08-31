import React from 'react';
import { useTheme } from '../../lib/theme';

export default function Toolbar({ className = '', left, right, children }) {
  const { density } = useTheme();
  const pad = density === 'compact' ? 'py-1 gap-2' : 'py-2 gap-3';
  return (
    <div className={`flex flex-wrap items-end justify-between ${pad} ${className}`}>
      <div className={`flex items-end ${density==='compact'?'gap-2':'gap-3'}`}>{left || null}</div>
      <div className={`flex items-center ${density==='compact'?'gap-2':'gap-3'}`}>{right || children || null}</div>
    </div>
  );
}
