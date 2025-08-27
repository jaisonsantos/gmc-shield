// web/src/pages/Stores.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Stores as Api, WP } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { PageHeader } from "../components/Page";
import Button from "../components/Button";
import { PlusCircle, RefreshCw, PlayCircle, Eye, History } from "lucide-react";

export default function Stores() {
  const { can } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState({});
  const [wpStatus, setWpStatus] = useState({});

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
      toast.success("Loja demo criada. A recarregar a lista...");
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
      toast.error(e.message || "Falha ao iniciar scan");
    }
  };

  return (
    <div>
      <PageHeader>
        <div className="ph-left">
          <h2 style={{ margin: 0 }}>Minhas Lojas</h2>
        </div>
        <div className="ph-right" style={{ display: 'flex', gap: '8px' }}>
          <Button variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={16} /> Recarregar
          </Button>
          {can("scan") && (
            <Button onClick={createDemo}>
              <PlusCircle size={16} /> Criar Loja Demo
            </Button>
          )}
        </div>
      </PageHeader>

      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}

      {loading ? (
        <div>A carregar lojas...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <h3>Nenhuma loja encontrada</h3>
          <p className="muted">Comece por criar uma nova loja para monitorizar.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {items.map((s) => (
            <div className="store-card" key={s.id}>
              {/* ===== MUDANÇA PRINCIPAL AQUI ===== */}
              <Link to={`/app/stores/${s.id}`} className="store-card-link-main">
                <div className="store-card-header">
                  <h3>{s.name || `Loja #${s.id}`}</h3>
                  <span className="platform-badge">{s.platform}</span>
                </div>
                <div className="store-card-body">
                  <p className="muted">{s.base_url}</p>
                </div>
                <div className="store-card-footer">
                  <span className={`status-pill ${wpStatus[s.id]?.connected ? 'ok' : 'off'}`}>
                    WP {wpStatus[s.id]?.connected ? "Conectado" : "Offline"}
                  </span>
                  <span>{s.country} • {s.currency}</span>
                </div>
              </Link>
              {/* =================================== */}
              
              <div className="store-card-actions">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <Link to={`/app/stores/${s.id}/violations`} className="btn-link-action" title="Ver Violações">
                    <Eye size={14}/> <span>Violações</span>
                  </Link>
                  <Link to={`/app/stores/${s.id}/scans`} className="btn-link-action" title="Ver Execuções de Scan">
                    <History size={14}/> <span>Scans</span>
                  </Link>
                </div>
                {can("scan") && (
                  <Button 
                    size="sm" 
                    variant="solid" 
                    disabled={!!scanning[s.id]} 
                    onClick={() => doScan(s.id)}
                    title="Iniciar uma nova execução de scan"
                  >
                    <PlayCircle size={14}/>
                    {scanning[s.id] ? "A processar…" : "Scan"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}