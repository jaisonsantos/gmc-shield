// web/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Button from "../components/Button";
import { Input } from "../components/Input";
import { Shield } from 'lucide-react';
import { apiFetch, setToken } from "../lib/api";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login, boot } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("owner@gmcshield.dev");
  const [password, setPassword] = useState("demo");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      setToken(t);
      (async () => {
        await boot();
        const from = location.state?.from?.pathname || "/app/dashboard";
        nav(from, { replace: true });
      })();
    }
  }, [searchParams, boot, nav, location.state]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
      const from = location.state?.from?.pathname || "/app/dashboard";
      nav(from, { replace: true });
    } catch (e) {
      setErr(e.message || "Falha no login");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setErr("");
    setBusy(true);
    try {
      const rt = `${window.location.origin}/login`;
      const res = await apiFetch(`/api/auth/google/start?return_to=${encodeURIComponent(rt)}`);
      if (res.auth_url) window.location.href = res.auth_url;
    } catch (e) {
      setErr(e.message || "Falha no login");
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9fafb', padding: '16px' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <div className="stack" style={{ gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'inherit', textDecoration: 'none' }}>
              <Shield className="h-8 w-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900">GMC Shield</span>
            </Link>
            <p className="muted" style={{ marginTop: '8px' }}>
              Ainda não tem conta? <Link to="/">Voltar ao site</Link>.
            </p>
          </div>
          <form onSubmit={onSubmit} className="stack" style={{ gap: 16 }}>
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
            <Input
              label="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
            {err && <div className="error">{err}</div>}
            <Button type="submit" loading={busy} style={{ width: '100%' }}>
              {busy ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div style={{display:'flex',alignItems:'center',gap:'1rem',color:'#6b7280'}}>
            <hr style={{flex:1,borderColor:'#e5e7eb'}}/>
            <span>OU</span>
            <hr style={{flex:1,borderColor:'#e5e7eb'}}/>
          </div>
          <Button variant="outline" onClick={handleGoogle} loading={busy} style={{ width: '100%' }}>
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  );
}
