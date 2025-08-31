import React from 'react';

export default function Button({
  variant = 'solid', // solid | outline | ghost | danger
  size = 'md', // sm | md | lg
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
  const sizes = {
    sm: 'text-sm px-2.5 py-1.5',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2.5',
  };
  const variants = {
    solid: 'bg-accent text-white hover:bg-accent/90 border border-accent',
    outline: 'bg-transparent text-accent border border-accent hover:bg-accent/5',
    ghost: 'bg-transparent text-accent hover:bg-accent/5 border border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-500 border border-red-600',
  };
  const isDisabled = disabled || loading;
  const cls = [base, sizes[size] || sizes.md, variants[variant] || variants.solid, isDisabled ? 'opacity-60 cursor-not-allowed' : '', className].join(' ');
  return (
    <button {...props} disabled={isDisabled} className={cls}>
      {loading && <span aria-hidden>⏳</span>}
      {children}
    </button>
  );
}
