// web/src/pages/Scans.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Runs, Stores as StoresApi } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import { RefreshCw, Clock, ArrowRight } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Table, THead, Th, TBody, Tr, Td } from "../components/ui/Table";

export default function Scans() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await Runs.list(id);
      setItems(Array.isArray(data) ? data : data.items || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // Auto-refresh
    return () => clearInterval(t);
  }, [id]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  return (
    <section className="card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
         <h3>{t('store.tabs.scans')}</h3>
         <div style={{ display: 'flex', gap: 8 }}>
           <Button variant="ghost" onClick={load} loading={loading}>
              <RefreshCw size={16} /> {t('common.refresh')}
            </Button>
            <Button onClick={async () => {
              try {
                setScanning(true);
                const res = await StoresApi.scan(id);
                toast.success(t('common.success'));
                setTimeout(load, 1200);
              } catch (e) {
                toast.error(e.message || 'Scan failed');
              } finally {
                setScanning(false);
              }
            }} disabled={scanning}>
              {scanning ? t('common.loading') : t('scans.start')}
            </Button>
         </div>
      </div>
      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
      <Table>
        <THead>
          <Th>ID</Th>
          <Th>Status</Th>
          <Th>{t('scans.startAt')}</Th>
          <Th>{t('scans.endAt')}</Th>
          <Th>{t('scans.results')}</Th>
          <Th>{t('scans.actions')}</Th>
        </THead>
        <TBody>
            {loading ? (
              <Tr><Td align="center" colSpan={6}><Clock size={16} className="inline mr-2" />{t('common.loading')}</Td></Tr>
            ) : items.length === 0 ? (
              <Tr><Td align="center" colSpan={6}>—</Td></Tr>
            ) : (
              items.map((r) => (
                <Tr key={r.id}>
                  <Td mono>{r.id}</Td>
                  <Td><span className={`inline-flex px-2 py-0.5 rounded text-xs ${r.status === 'done' ? 'bg-green-100 text-green-800' : r.status === 'running' ? 'bg-blue-100 text-blue-800' : r.status === 'queued' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>{r.status}</span></Td>
                  <Td>{formatDate(r.started_at)}</Td>
                  <Td>{formatDate(r.finished_at)}</Td>
                  <Td>{r.items_ok} OK / {r.items_violation} {t('store.tabs.violations')}</Td>
                  <Td><Link to={`/app/stores/${id}/violations?run_id=${r.id}`} className="text-accent dark:text-purple-300 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded">{t('store.tabs.violations')} <ArrowRight size={14} /></Link></Td>
                </Tr>
              ))
            )}
        </TBody>
      </Table>
    </section>
  );
}
