// web/src/components/Input.jsx
import React from "react";

const VARIANTS = {
  outline: {
    background: "var(--bg)",
    border: "1px solid var(--line)"
  },
  filled: {
    background: "var(--line)",
    border: "1px solid var(--line)"
  }
};

const SIZES = {
  sm: { fontSize: 12, padding: "4px 6px" },
  md: { fontSize: 14, padding: "6px 8px" },
  lg: { fontSize: 16, padding: "8px 12px" }
};

function BaseField({ as: Comp = "input", variant = "outline", size = "md", error, helper, style, ...props }) {
  const variantStyle = VARIANTS[variant] || VARIANTS.outline;
  const sizeStyle = SIZES[size] || SIZES.md;
  const fieldStyle = {
    color: "var(--fg)",
    borderRadius: 4,
    width: "100%",
    ...variantStyle,
    ...sizeStyle,
    ...(error ? { borderColor: "var(--accent)" } : {}),
    ...style
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Comp style={fieldStyle} {...props} />
      {error ? (
        <span style={{ color: "var(--accent)", fontSize: 12 }}>{error}</span>
      ) : helper ? (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{helper}</span>
      ) : null}
    </div>
  );
}

export default function Input(props) {
  return <BaseField as="input" {...props} />;
}

export function Textarea(props) {
  return <BaseField as="textarea" {...props} />;
}
