// web/src/pages/Violations.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Violations as Api, Blocks } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import Button from "../components/Button";
import { RefreshCw, Clock, Ban, CheckCircle } from "lucide-react";

export default function Violations() {
  const { id } = useParams();
  const location = useLocation();
  const runId = new URLSearchParams(location.search).get("run_id");
  const { can } = useAuth();
  const toast = useToast();

  const [data, setData] = useState({ items: [], page: 1, total: 0 });
  const [blockedByItem, setBlockedByItem] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const [viol, blocks] = await Promise.all([Api.list(id, runId), Blocks.list(id)]);
      setData(viol);
      const map = {};
      (blocks.items || blocks).forEach((b) => {
        if (b.active) map[b.feed_item_id] = b.id;
      });
      setBlockedByItem(map);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, runId]);

  const blockItem = async (feedItemId) => {
    if (!feedItemId) return;
    try {
      setErr("");
      setBusy(feedItemId);
      await Blocks.create(id, feedItemId);
      toast.success(`Item ${feedItemId} bloqueado`);
      await load();
    } catch (e) {
      toast.error(e.message || "Falha ao bloquear");
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const unblockItem = async (feedItemId) => {
    if (!feedItemId) return;
    try {
      setErr("");
      setBusy(feedItemId);
      await Blocks.removeByFeedItem(id, feedItemId);
      toast.success(`Item ${feedItemId} desbloqueado`);
      await load();
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="card">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
         <h3>Violações Encontradas</h3>
         <Button variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={16} /> Recarregar
          </Button>
      </div>

      {runId && <div className="pill meta" style={{ marginBottom: 16 }}>Filtrando por execução #{runId}</div>}
      
      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID Violação</th>
              <th>Regra</th>
              <th>Severidade</th>
              <th>Item do Feed</th>
              <th>Mensagem</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="td-center muted">
                  <Clock size={16} style={{ marginRight: 6 }} />
                  A carregar violações…
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="td-center muted">Nenhuma violação encontrada.</td>
              </tr>
            ) : (
              data.items.map((v) => {
                const isBlocked = !!blockedByItem[v.feed_item_id];
                return (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td className="mono">{v.rule_code}</td>
                    <td><span className={`severity-pill ${v.severity}`}>{v.severity}</span></td>
                    <td className="mono">{v.feed_item_id || "-"}</td>
                    <td>{v.message}</td>
                    <td style={{ textAlign: 'center' }}>
                      {can("block") && v.feed_item_id && (
                        isBlocked ? (
                          <Button variant="outline" size="sm" disabled={busy === v.feed_item_id} onClick={() => unblockItem(v.feed_item_id)}>
                            <CheckCircle size={14} /> {busy === v.feed_item_id ? "Aguarde..." : "Desbloquear"}
                          </Button>
                        ) : (
                          <Button variant="solid" size="sm" disabled={busy === v.feed_item_id} onClick={() => blockItem(v.feed_item_id)}>
                            <Ban size={14} /> {busy === v.feed_item_id ? "Aguarde..." : "Bloquear"}
                          </Button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}