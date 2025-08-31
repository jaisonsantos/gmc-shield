// web/src/pages/Stores.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Stores as Api, WP } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { PageHeader } from "../components/Page";
import Card from "../components/ui/Card";
import Button from "../components/Button";
import { PlusCircle, RefreshCw, PlayCircle, Eye, History } from "lucide-react";
import { useTranslation } from 'react-i18next';

export default function Stores() {
  const { can } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState({});
  const [wpStatus, setWpStatus] = useState({});
  const { t } = useTranslation();

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await Api.list();
      const stores = Array.isArray(data) ? data : data.items || [];
      setItems(stores);
      
      const statuses = {};
      await Promise.all(stores.map(async (s) => {
        try { statuses[s.id] = await WP.status(s.id); } catch {}
      }));
      setWpStatus(statuses);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createDemo = async () => {
    try {
      await Api.createDemo();
      toast.success(t('common.success'));
      await load();
    } catch (e) {
      setErr(e.message);
      toast.error(e.message);
    }
  };

  const doScan = async (storeId) => {
    try {
      setScanning((m) => ({ ...m, [storeId]: true }));
      const res = await Api.scan(storeId);
      const runId = res.run_id;
      toast.success(
        <span>
          Scan iniciado (Run #{runId}).{' '}
          <Link to={`/app/stores/${storeId}/scans`} style={{ color: 'white', textDecoration: 'underline' }}>
            Ver progresso.
          </Link>
        </span>
      );
      setTimeout(() => {
        setScanning((m) => ({ ...m, [storeId]: false }));
      }, 3500);
    } catch (e) {
      setScanning((m) => ({ ...m, [storeId]: false }));
      toast.error(e.message || 'Scan failed');
    }
  };

  return (
    <div>
      <PageHeader>
        <div className="flex items-center gap-3">
          <h2 className="m-0">{t('stores.title')}</h2>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={16} /> {t('common.refresh')}
          </Button>
          {can("scan") && (
            <Button onClick={createDemo}>
              <PlusCircle size={16} /> {t('stores.createDemo')}
            </Button>
          )}
        </div>
      </PageHeader>

      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}

      {loading ? (
        <div>{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center space-y-2">
          <h3 className="text-lg font-semibold">{t('stores.emptyTitle')}</h3>
          <p className="text-gray-500">{t('stores.emptyDesc')}</p>
          {can("scan") && (
            <Button onClick={createDemo}><PlusCircle size={16} /> {t('stores.createDemo')}</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {items.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col gap-3">
              <Link to={`/app/stores/${s.id}`} className="no-underline">
                <div className="flex items-center justify-between">
                  <h3 className="m-0 text-base font-semibold">{s.name || `Loja #${s.id}`}</h3>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{s.platform}</span>
                </div>
                <div className="text-gray-500 text-sm">{s.base_url}</div>
                <div className="flex items-center gap-2 text-sm text-gray-700 mt-2">
                  <span className={`px-2 py-0.5 rounded ${wpStatus[s.id]?.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    WP {wpStatus[s.id]?.connected ? 'OK' : 'Offline'}
                  </span>
                  {s.google_merchant_id && (
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-800" title={`Merchant ${s.google_merchant_id}`}>
                      GMC OK
                    </span>
                  )}
                  <span className="ml-auto text-gray-500">{s.country} • {s.currency}</span>
                </div>
              </Link>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Link to={`/app/stores/${s.id}/violations`} className="inline-flex items-center gap-1 text-accent dark:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded" title="Violations">
                    <Eye size={14}/> <span>{t('store.tabs.violations')}</span>
                  </Link>
                  <Link to={`/app/stores/${s.id}/scans`} className="inline-flex items-center gap-1 text-accent dark:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded" title="Scans">
                    <History size={14}/> <span>{t('store.tabs.scans')}</span>
                  </Link>
                </div>
                {can("scan") && (
                  <Button size="sm" variant="solid" disabled={!!scanning[s.id]} onClick={() => doScan(s.id)} title="Start a new scan">
                    <PlayCircle size={14}/>
                    {scanning[s.id] ? t('common.loading') : 'Scan'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
