import React from "react";

/**
 * Button com variantes e tamanhos, mantendo compat.
 * Mantém os nomes de variante do master: solid | outline | ghost
 * Usa CSS var(--accent) com fallback via CSS global.
 */
const BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 600,
};

const SIZES = {
  sm: { fontSize: 12, padding: "4px 8px" },
  md: { fontSize: 14, padding: "6px 12px" },
  lg: { fontSize: 16, padding: "10px 16px" },
};

export default function Button({
  variant = "solid", // solid | outline | ghost
  size = "md",       // sm | md | lg
  loading = false,
  disabled = false,
  style,
  children,
  ...props
}) {
  const accent = "var(--accent)";

  const VARIANTS = {
    solid:   { background: accent, color: "#fff", border: `1px solid ${accent}` },
    outline: { background: "transparent", color: accent, border: `1px solid ${accent}` },
    ghost:   { background: "transparent", color: accent, border: "1px solid transparent" },
  };

  const variantStyle = VARIANTS[variant] || VARIANTS.solid;
  const sizeStyle = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{ ...BASE, ...variantStyle, ...sizeStyle, ...(style || {}), opacity: isDisabled ? 0.7 : 1 }}
    >
      {loading && <span aria-hidden>⏳</span>}
      {children}
    </button>
  );
}
