// web/src/components/Input.jsx
import React from "react";

/**
 * Componentes de campo reutilizáveis.
 * - export default: Input
 * - export named:   Textarea
 * Uso:
 *   import Input, { Textarea } from "../components/Input";
 */

export function Input({ label, helper, error, fullWidth = true, style, ...props }) {
  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>
      {label && <label className="label">{label}</label>}
      <input className="input" aria-invalid={!!error} style={style} {...props} />
      {helper && !error && <div className="helper">{helper}</div>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

export function Textarea({ label, helper, error, rows = 6, fullWidth = true, style, ...props }) {
  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>
      {label && <label className="label">{label}</label>}
      <textarea className="input" rows={rows} aria-invalid={!!error} style={style} {...props} />
      {helper && !error && <div className="helper">{helper}</div>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

export default Input;
