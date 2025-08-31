import React from 'react';
import { useTheme } from '../lib/theme';

export default function DensitySwitcher({ compact = true }) {
  const { density, setDensity } = useTheme();
  if (compact) {
    return (
      <select value={density} onChange={(e) => setDensity(e.target.value)} className="px-2 py-1 text-sm border border-gray-300 rounded-md w-full">
        <option value="comfort">Comfort</option>
        <option value="compact">Compact</option>
      </select>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button className={`px-2 py-1 text-sm rounded-md border ${density==='comfort'?'bg-gray-100':'bg-white'}`} onClick={() => setDensity('comfort')}>Comfort</button>
      <button className={`px-2 py-1 text-sm rounded-md border ${density==='compact'?'bg-gray-100':'bg-white'}`} onClick={() => setDensity('compact')}>Compact</button>
    </div>
  );
}

