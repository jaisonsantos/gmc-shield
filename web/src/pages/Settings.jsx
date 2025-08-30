import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast.jsx";

export default function Settings() {
  const { ready, isAuthenticated } = useAuth();
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
      toast.success(`Vinculado ao Merchant ${id} na loja #${sid}`);
    }
    try {
      const prods = await apiFetch(`/api/google/mc/${id}/products`);
      setProducts(prods);
    } catch (_) {
      // ignore erro aqui; manter UI sem travar
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      <div>
        <h2>Google Merchant Center</h2>
        {stores.length > 0 && (
          <div style={{ margin: '8px 0' }}>
            <label style={{ marginRight: 8 }}>Loja:</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>#{s.id} — {s.name || `Loja #${s.id}`}</option>
              ))}
            </select>
          </div>
        )}
        {(!accounts && !loadingAccounts) && (
          <button onClick={connect}>Conectar Merchant Center</button>
        )}
        {loadingAccounts && <div className="muted" style={{ marginTop: 8 }}>Carregando contas do MC…</div>}
        {accounts && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <select value={merchant} onChange={(e) => chooseMerchant(e.target.value)}>
              <option value="">Selecione merchant</option>
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
                  toast.success(`Importados ${res?.imported ?? 0} itens do GMC para a loja #${storeId}`);
                } catch (e) {
                  toast.error(e.message || 'Falha ao importar');
                } finally { setImporting(false); }
              }}>
                {importing ? 'Importando…' : 'Importar agora'}
              </button>
            )}
          </div>
        )}
        {merchant && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Produtos (amostra)</h3>
              <button onClick={async () => {
                try {
                  setLoadingProducts(true);
                  const prods = await apiFetch(`/api/google/mc/${merchant}/products`);
                  setProducts(prods);
                } finally { setLoadingProducts(false); }
              }} disabled={loadingProducts}>Recarregar</button>
            </div>
            {loadingProducts && <div className="muted" style={{ padding: 12 }}>Carregando produtos…</div>}
            {!loadingProducts && products && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Offer ID</th><th>Título</th><th>Preço</th><th>Disp.</th></tr>
                  </thead>
                  <tbody>
                    {(products.resources || []).slice(0, 10).map((p) => (
                      <tr key={p.offerId || p.id}>
                        <td className="mono">{p.offerId || p.id}</td>
                        <td>{p.title}</td>
                        <td>{(p.price?.value || '-') + (p.price?.currency ? ` ${p.price.currency}` : '')}</td>
                        <td>{p.availability || '-'}</td>
                      </tr>
                    ))}
                    {(!products.resources || products.resources.length === 0) && (
                      <tr><td colSpan={4} className="td-center muted">Nenhum produto retornado pelo MC.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
