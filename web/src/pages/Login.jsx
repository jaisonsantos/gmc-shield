// web/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("owner@gmcshield.dev");
  const [password, setPassword] = useState("demo");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      const from = location.state?.from?.pathname || "/";
      nav(from, { replace: true });
    } catch (e) {
      setErr(e.message || "Falha no login");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
      <h1 style={{ marginBottom: 12 }}>Entrar</h1>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4 }}
            type="email"
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Senha
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4 }}
            type="password"
            required
          />
        </label>
        {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}
        <button type="submit" style={{ padding: "10px 16px" }}>Entrar</button>
      </form>
    </div>
  );
}
