// web/lib/toast.jsx

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t) => {
      const id = (globalThis.crypto?.randomUUID?.() || "") || String(Date.now() + Math.random());
      const toast = {
        id,
        type: t.type || "info",               // "success" | "error" | "info"
        message: t.message ?? "",
        duration: Number.isFinite(t.duration) ? t.duration : 3000,
      };
      setToasts((ts) => [...ts, toast]);
      setTimeout(() => dismiss(id), toast.duration);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      show: (message, opts = {})   => push({ ...opts, message }),
      success: (message, opts = {})=> push({ ...opts, type: "success", message }),
      error: (message, opts = {})  => push({ ...opts, type: "error", message }),
      info: (message, opts = {})   => push({ ...opts, type: "info", message }),
    }),
    [push]
  );

  const color = (type) =>
    type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          display: "grid",
          gap: 8,
          zIndex: 1000,
          maxWidth: 360,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#111827",
              color: "white",
              border: `1px solid ${color(t.type)}`,
              padding: "10px 12px",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,.2)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: color(t.type),
                marginBottom: 4,
              }}
            >
              {t.type === "success" ? "Tudo certo" : t.type === "error" ? "Ops" : "Info"}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.35 }}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  // no-op fallback pra evitar crash fora do provider
  return useContext(ToastCtx) || {
    show: () => {},
    success: () => {},
    error: () => {},
    info: () => {},
  };
}
