// web/src/components/Button.jsx
import React from "react";

const VARIANTS = {
  solid: {
    background: "var(--accent)",
    color: "#fff",
    border: "1px solid var(--accent)"
  },
  outline: {
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid var(--accent)"
  },
  ghost: {
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid transparent"
  }
};

const SIZES = {
  sm: { fontSize: 12, padding: "4px 8px" },
  md: { fontSize: 14, padding: "6px 12px" },
  lg: { fontSize: 16, padding: "10px 16px" }
};

export default function Button({ variant = "solid", size = "md", style, ...props }) {
  const variantStyle = VARIANTS[variant] || VARIANTS.solid;
  const sizeStyle = SIZES[size] || SIZES.md;
  return <button style={{ ...variantStyle, ...sizeStyle, ...style }} {...props} />;
}
