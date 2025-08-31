// web/src/components/Input.jsx
import React from "react";

/**
 * Componentes de campo reutilizáveis.
 * - export default: Input
 * - export named:   Textarea
 * Uso:
 *   import Input, { Textarea } from "../components/Input";
 */

export function Input({ label, helper, error, fullWidth = true, className = "", style, ...props }) {
  const base = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50";
  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <input className={`${base} ${className}`} aria-invalid={!!error} style={style} {...props} />
      {helper && !error && <div className="text-xs text-gray-500 mt-1">{helper}</div>}
      {error && <div className="text-xs text-red-600 mt-1" role="alert">{error}</div>}
    </div>
  );
}

export function Textarea({ label, helper, error, rows = 6, fullWidth = true, className = "", style, ...props }) {
  const base = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50";
  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <textarea className={`${base} ${className}`} rows={rows} aria-invalid={!!error} style={style} {...props} />
      {helper && !error && <div className="text-xs text-gray-500 mt-1">{helper}</div>}
      {error && <div className="text-xs text-red-600 mt-1" role="alert">{error}</div>}
    </div>
  );
}

export default Input;
