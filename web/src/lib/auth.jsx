// web/src/lib/auth.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Auth as Api, setToken, getToken, clearToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, role, account_id }
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // bootstrap: se tem token salvo, tenta whoami
    const boot = async () => {
      const t = getToken();
      if (!t) return setReady(true);
      try {
        const me = await Api.whoami();
        setUser(me);
      } catch {
        clearToken();
      } finally {
        setReady(true);
      }
    };
    boot();
  }, []);

  const login = async (email, password) => {
    const { access_token } = await Api.login(email, password);
    setToken(access_token);
    const me = await Api.whoami();
    setUser(me);
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

  const value = { user, ready, isAuthenticated: !!user, login, logout, can };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}