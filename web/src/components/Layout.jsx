// web/src/components/Layout.jsx
import React from "react";

const VARIANTS = {
  centered: { margin: "0 auto" },
  fluid: { width: "100%" }
};

const SIZES = {
  sm: "640px",
  md: "768px",
  lg: "1024px"
};

export default function Layout({
  variant = "centered",
  size = "md",
  style,
  children,
  ...props
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.centered;
  const maxWidth = SIZES[size] || SIZES.md;
  const layoutStyle = {
    color: "var(--fg)",
    background: "var(--bg)",
    maxWidth,
    padding: "0 16px",
    ...variantStyle,
    ...style
  };
  return (
    <div style={layoutStyle} {...props}>
      {children}
    </div>
  );
}
