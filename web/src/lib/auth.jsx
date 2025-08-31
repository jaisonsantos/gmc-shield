// web/src/lib/auth.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Auth as Api, Me, setToken, getToken, clearToken } from "./api";
import i18n from '../i18n';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, role, account_id }
  const [ready, setReady] = useState(false);

  // bootstrap: se tem token salvo, tenta whoami
  const boot = async () => {
    setReady(false);
    const t = getToken();
    if (!t) return setReady(true);
    try {
      const me = await Api.whoami();
      setUser(me);
      try {
        const prefs = await Me.getPreferences();
        const map = { 'en_US': 'en', 'pt_BR': 'pt', 'es_ES': 'es' };
        if (prefs?.locale && map[prefs.locale]) await i18n.changeLanguage(map[prefs.locale]);
      } catch {}
    } catch {
      clearToken();
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    // Captura token via query param em qualquer rota (ex.: retorno do OAuth)
    try {
      let t = getToken();
      if (!t && typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const qtok = sp.get("token");
        if (qtok) {
          setToken(qtok);
          t = qtok;
          // Limpa o token da URL para evitar reaproveitar em refresh
          sp.delete("token");
          const newQs = sp.toString();
          const newUrl = `${window.location.pathname}${newQs ? `?${newQs}` : ""}${window.location.hash || ""}`;
          window.history.replaceState({}, "", newUrl);
        }
      }
    } catch { /* noop */ }
    boot();
  }, []);

  const login = async (email, password) => {
    const { access_token } = await Api.login(email, password);
    setToken(access_token);
    const me = await Api.whoami();
    setUser(me);
    try {
      const prefs = await Me.getPreferences();
      const map = { 'en_US': 'en', 'pt_BR': 'pt', 'es_ES': 'es' };
      if (prefs?.locale && map[prefs.locale]) await i18n.changeLanguage(map[prefs.locale]);
    } catch {}
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  // RBAC simples
  const can = (action) => {
    const role = user?.role;
    if (!role) return false;
    if (action === "scan" || action === "block") return role === "owner" || role === "manager";
    return true; // viewer pode listar
  };

  const value = { user, ready, isAuthenticated: !!user, login, logout, can, boot };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
