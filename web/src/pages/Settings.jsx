import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast.jsx";
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeSwitcher from "../components/ThemeSwitcher";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import DensitySwitcher from "../components/DensitySwitcher";

export default function Settings() {
  const { ready, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState(null);
  const [merchant, setMerchant] = useState("");
  const [products, setProducts] = useState(null);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const toast = useToast();
  const loadedRef = useRef(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!ready || !isAuthenticated) return; // aguarda auth
    if (loadedRef.current) return; // evita dupla execução (StrictMode)
    loadedRef.current = true;
    (async () => {
      try {
        // carrega lojas do usuário e define uma padrão (a primeira)
        const ss = await apiFetch("/api/stores");
        if (Array.isArray(ss) && ss.length > 0) {
          setStores(ss);
          setStoreId(String(ss[0].id));
        }
      } catch (_) {}
      try {
        setLoadingAccounts(true);
        const data = await apiFetch("/api/google/mc/accounts");
        if (data) setAccounts(data);
      } catch (e) {
        // mostra botão conectar apenas se o erro for escopo/sem auth do MC
        if (e && e.status && (e.status === 400 || e.status === 403)) {
          setAccounts(null);
        }
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, [ready, isAuthenticated]);

  // sempre que as lojas carregarem ou mudarmos a loja selecionada,
  // preenche o merchant com o valor salvo (se existir)
  useEffect(() => {
    if (!stores.length || !storeId) return;
    const s = stores.find((x) => String(x.id) === String(storeId));
    if (s && s.google_merchant_id && !merchant) {
      setMerchant(String(s.google_merchant_id));
    }
  }, [stores, storeId]);

  // quando tivermos um merchant selecionado, busca os produtos automaticamente
  useEffect(() => {
    (async () => {
      if (!merchant) { setProducts(null); return; }
      try {
        setLoadingProducts(true);
        const prods = await apiFetch(`/api/google/mc/${merchant}/products`);
        setProducts(prods);
      } catch (_) { /* ignore */ }
      finally { setLoadingProducts(false); }
    })();
  }, [merchant]);

  const connect = async () => {
    const rt = `${window.location.origin}/app/settings`;
    try {
      const res = await apiFetch(`/api/auth/google/start-content?return_to=${encodeURIComponent(rt)}`);
      if (res?.auth_url) window.location.href = res.auth_url;
    } catch (e) {
      // opcional: exibir erro no futuro
      console.error("Falha no start-content:", e);
    }
  };

  const chooseMerchant = async (id) => {
    setMerchant(id);
    const sid = storeId || (stores[0] ? String(stores[0].id) : "");
    if (sid) {
      await apiFetch(`/api/stores/${sid}`, { method: "PATCH", body: { google_merchant_id: id } });
      toast.success(t('settings.linkedMerchant', { id, sid }));
    }
    try {
      const prods = await apiFetch(`/api/google/mc/${id}/products`);
      setProducts(prods);
    } catch (_) {
      // ignore erro aqui; manter UI sem travar
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('nav.settings')}</h1>
      {/* Preferences */}
      <Card>
        <SectionHeader title={t('settings.preferences') || 'Preferences'} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('language.label')}</label>
            <LanguageSwitcher compact />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Theme</label>
            <ThemeSwitcher compact />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Density</label>
            <DensitySwitcher compact />
          </div>
        </div>
      </Card>
      <Card>
        <SectionHeader title={t('settings.gmc')} />
        {stores.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">{t('settings.store')}:</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="px-2 py-1 border border-gray-300 rounded-md">
              {stores.map((s) => (
                <option key={s.id} value={s.id}>#{s.id} — {s.name || t('store.title', { id: s.id })}</option>
              ))}
            </select>
          </div>
        )}
        {(!accounts && !loadingAccounts) && (
          <button onClick={connect} className="px-3 py-2 text-sm font-semibold text-white bg-accent rounded-md">{t('settings.connect')}</button>
        )}
        {loadingAccounts && <div className="muted mt-2">{t('settings.loadingAccounts')}</div>}
        {accounts && (
          <div className="flex items-center gap-2 mt-2">
            <select value={merchant} onChange={(e) => chooseMerchant(e.target.value)} className="px-2 py-1 border border-gray-300 rounded-md">
              <option value="">{t('settings.selectMerchant')}</option>
              {accounts.accountIdentifiers?.map((a) => (
                <option key={a.merchantId} value={a.merchantId}>
                  {a.merchantId}
                </option>
              ))}
            </select>
            {merchant && (
              <button disabled={importing || !storeId} onClick={async () => {
                try {
                  setImporting(true);
                  const res = await apiFetch(`/api/google/mc/${merchant}/import?store_id=${encodeURIComponent(storeId)}`, { method: "POST" });
                  toast.success(t('settings.imported', { count: res?.imported ?? 0, sid: storeId }));
                } catch (e) {
                  toast.error(e.message || t('settings.importFailed'));
                } finally { setImporting(false); }
              }} className="px-3 py-2 text-sm font-semibold text-accent border border-accent rounded-md">
                {importing ? t('common.loading') : t('settings.importNow')}
              </button>
            )}
          </div>
        )}
        {merchant && (
          <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0 font-semibold">{t('settings.products')}</h3>
              <button onClick={async () => {
                try {
                  setLoadingProducts(true);
                  const prods = await apiFetch(`/api/google/mc/${merchant}/products`);
                  setProducts(prods);
                } finally { setLoadingProducts(false); }
              }} disabled={loadingProducts} className="px-3 py-1.5 text-sm border rounded-md">{t('common.refresh')}</button>
            </div>
            {loadingProducts && <div className="text-gray-500 p-3">{t('common.loading')}</div>}
            {!loadingProducts && products && (
              <div className="">
                {/* Tabela padronizada (respeita density + dark) */}
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-gray-900 dark:text-gray-100">
                    <thead className="bg-gray-50 dark:bg-gray-800/80">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.title')}</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.price')}</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.availability')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900/40 divide-y divide-gray-200 dark:divide-gray-800 [&>tr>td]:px-3 [&>tr>td]:py-2">
                      {(products.resources || []).slice(0, 10).map((p) => (
                        <tr key={p.offerId || p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                          <td className="font-mono">{p.offerId || p.id}</td>
                          <td>{p.title}</td>
                          <td>{(p.price?.value || '-') + (p.price?.currency ? ` ${p.price.currency}` : '')}</td>
                          <td>{p.availability || '-'}</td>
                        </tr>
                      ))}
                      {(!products.resources || products.resources.length === 0) && (
                        <tr><td colSpan={4} className="text-center text-gray-500 py-6">{t('settings.noneProducts')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
