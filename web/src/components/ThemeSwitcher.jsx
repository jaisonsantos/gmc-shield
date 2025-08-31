import React from 'react';
import { useTheme } from '../lib/theme';

export default function ThemeSwitcher({ compact = true }) {
  const { theme, setTheme } = useTheme();
  if (compact) {
    return (
      <select value={theme} onChange={(e) => setTheme(e.target.value)} className="px-2 py-1 text-sm border border-gray-300 rounded-md w-full">
        <option value="light">Light</option>
        <option value="system">System</option>
        <option value="dark">Dark</option>
      </select>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button className={`px-2 py-1 text-sm rounded-md border ${theme==='light'?'bg-gray-100':'bg-white'}`} onClick={() => setTheme('light')}>Light</button>
      <button className={`px-2 py-1 text-sm rounded-md border ${theme==='system'?'bg-gray-100':'bg-white'}`} onClick={() => setTheme('system')}>System</button>
      <button className={`px-2 py-1 text-sm rounded-md border ${theme==='dark'?'bg-gray-100':'bg-white'}`} onClick={() => setTheme('dark')}>Dark</button>
    </div>
  );
}

