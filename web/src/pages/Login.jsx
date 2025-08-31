// web/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Button from "../components/Button";
import { Input } from "../components/Input";
import { Shield } from 'lucide-react';
import { apiFetch, setToken } from "../lib/api";
import { useTranslation } from 'react-i18next';

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login, boot } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("owner@gmcshield.dev");
  const [password, setPassword] = useState("demo");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

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
      setErr(e.message || t('auth.loginFailed'));
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
      setErr(e.message || t('auth.loginFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
          <div className="text-center space-y-1">
            <Link to="/" className="inline-flex items-center gap-2 no-underline">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-50 text-purple-600"><Shield /></span>
              <span className="text-2xl font-bold text-gray-900">{t('app.name')}</span>
            </Link>
            <p className="text-sm text-gray-500">
              {t('auth.noAccount')} <Link to="/" className="text-accent hover:underline">{t('auth.backToSite')}</Link>.
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            <Input label={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            {err && <div className="text-sm text-red-600">{err}</div>}
            <Button type="submit" loading={busy} className="w-full">
              {busy ? t('auth.loggingIn') : t('auth.login')}
            </Button>
          </form>
          <div className="flex items-center gap-3 text-gray-500">
            <hr className="flex-1 border-gray-200" />
            <span className="text-sm">{t('auth.or')}</span>
            <hr className="flex-1 border-gray-200" />
          </div>
          <Button variant="outline" onClick={handleGoogle} loading={busy} className="w-full">
            {t('auth.continueGoogle')}
          </Button>
        </div>
      </div>
    </div>
  );
}
