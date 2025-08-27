// web/src/pages/Stores.jsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Stores as Api, WP } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";

export default function Stores() {
  const { user, logout, can } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState({}); // { [storeId]: true }
  const [wpStatus, setWpStatus] = useState({});

  const load = async () => {
    setErr("");
    setLoading(true);
      try {
        const data = await Api.list();
        setItems(Array.isArray(data) ? data : data.items || []);
        // fetch WP status for each store
        const statuses = {};
        await Promise.all((Array.isArray(data)?data:data.items||[]).map(async (s) => {
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
      await load();
      toast.success("Loja demo criada.");
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
      toast.show("Scan em processamento…");
      setTimeout(() => {
        setScanning((m) => ({ ...m, [storeId]: false }));
        toast.success(`Scan concluído. Run #${runId}`);
      }, 3500);
    } catch (e) {
      setScanning((m) => ({ ...m, [storeId]: false }));
      toast.error(e.message || "Falha ao iniciar scan");
    }
  };

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Lojas</h2>
        <div>
          <span style={{ marginRight: 12 }}>
            {user?.email} ({user?.role})
          </span>
          <button onClick={logout}>Sair</button>
        </div>
      </header>

      <div style={{ marginBottom: 12 }}>
        {can("scan") && <button onClick={createDemo}>Criar Demo Store</button>}
        <button onClick={load} style={{ marginLeft: 8 }}>
          Recarregar
        </button>
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

      {loading ? (
        <div>Carregando…</div>
      ) : items.length === 0 ? (
        <div>Nenhuma loja ainda.</div>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th>ID</th>
              <th>Platform</th>
              <th>Base URL</th>
              <th>País</th>
              <th>Moeda</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{s.id}</td>
                <td>{s.platform}</td>
                <td>{s.base_url}</td>
                <td>{s.country || "-"}</td>
                <td>{s.currency || "-"}</td>
                <td style={{ display: "flex", gap: 8 }}>
                    <Link to={`/app/stores/${s.id}/violations`}>Ver violações</Link>
                    <Link to={`/app/stores/${s.id}/scans`}>Ver execuções</Link>
                    <Link to={`/app/stores/${s.id}/feeds`}>Feed</Link>
                    <Link to={`/app/stores/${s.id}/items`}>Itens</Link>
                    <Link to={`/app/stores/${s.id}/wp`}>
                    WP{wpStatus[s.id] && (
                      <span style={{ marginLeft:4, fontSize:'0.8em' }}>
                        {wpStatus[s.id].connected ? "✅" : "❌"}
                        ({Object.keys(wpStatus[s.id].policies||{}).length})
                      </span>
                    )}
                  </Link>
                  {can("scan") && (
                    <button disabled={!!scanning[s.id]} onClick={() => doScan(s.id)}>
                      {scanning[s.id] ? "Em processamento…" : "Scan"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
