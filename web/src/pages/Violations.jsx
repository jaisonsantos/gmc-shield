import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { Violations as Api, Blocks } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";

export default function Violations() {
  const { id } = useParams();
  const loc = useLocation();
  const runId = new URLSearchParams(loc.search).get("run");
  const { can } = useAuth();
  const toast = useToast();

  const [data, setData] = useState({ items: [], page: 1, total: 0 });
  const [blockedByItem, setBlockedByItem] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(""); // feed_item_id em ação

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
    } catch (e) {
      toast.error(e.message || "Falha ao desbloquear");
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Violations — Store {id}</h2>
        <div>
          <Link to="/stores">← Voltar</Link>
          <button onClick={load} style={{ marginLeft: 8 }}>
            Recarregar
          </button>
        </div>
      </header>
      {runId && <div style={{ marginBottom: 8 }}>Filtrando por run #{runId}</div>}

      {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}
      {loading ? (
        <div>Carregando…</div>
      ) : data.items.length === 0 ? (
        <div>Sem violações.</div>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th>ID</th>
              <th>Rule</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Feed Item</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((v) => {
              const isBlocked = !!blockedByItem[v.feed_item_id];
              return (
                <tr key={v.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td>{v.id}</td>
                  <td>{v.rule_code}</td>
                  <td>{v.severity}</td>
                  <td>{v.message}</td>
                  <td>{v.feed_item_id || "-"}</td>
                  <td>{v.status}</td>
                  <td>
                    {can("block") && v.feed_item_id && (
                      isBlocked ? (
                        <button disabled={busy === v.feed_item_id} onClick={() => unblockItem(v.feed_item_id)}>
                          {busy === v.feed_item_id ? "Desbloqueando…" : "Desbloquear"}
                        </button>
                      ) : (
                        <button disabled={busy === v.feed_item_id} onClick={() => blockItem(v.feed_item_id)}>
                          {busy === v.feed_item_id ? "Bloqueando…" : "Bloquear"}
                        </button>
                      )
                    )}
                    {!can("block") && <span style={{ color: "#888" }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
