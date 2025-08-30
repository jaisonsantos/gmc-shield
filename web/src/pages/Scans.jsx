// web/src/pages/Scans.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Runs, Stores as StoresApi } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import { RefreshCw, Clock, ArrowRight } from "lucide-react";

export default function Scans() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const toast = useToast();

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
         <h3>Histórico de Execuções (Scans)</h3>
         <div style={{ display: 'flex', gap: 8 }}>
           <Button variant="ghost" onClick={load} loading={loading}>
              <RefreshCw size={16} /> Recarregar
            </Button>
            <Button onClick={async () => {
              try {
                setScanning(true);
                const res = await StoresApi.scan(id);
                toast.success(`Scan iniciado (Run #${res.run_id})`);
                setTimeout(load, 1200);
              } catch (e) {
                toast.error(e.message || "Falha ao iniciar scan");
              } finally {
                setScanning(false);
              }
            }} disabled={scanning}>
              {scanning ? 'A processar…' : 'Iniciar Scan'}
            </Button>
         </div>
      </div>
      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID Execução</th>
              <th>Status</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Resultados</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="td-center muted">
                  <Clock size={16} style={{ marginRight: 6 }} />
                  A carregar execuções…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="td-center muted">Nenhuma execução encontrada.</td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
                  <td>{formatDate(r.started_at)}</td>
                  <td>{formatDate(r.finished_at)}</td>
                  <td>{r.items_ok} OK / {r.items_violation} Violações</td>
                  <td>
                    <Link to={`/app/stores/${id}/violations?run_id=${r.id}`} className="btn-link-action">
                      Ver Violações <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
