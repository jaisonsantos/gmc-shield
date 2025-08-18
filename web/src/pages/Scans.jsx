import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Runs } from "../lib/api";

export default function Scans() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await Runs.list(id);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Scans — Store {id}</h2>
        <div>
          <Link to={`/stores/${id}`}>← Voltar</Link>
        </div>
      </header>
      {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}
      {loading ? (
        <div>Carregando…</div>
      ) : items.length === 0 ? (
        <div>Sem execuções.</div>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th>ID</th>
              <th>Status</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Itens OK/Viol.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{r.id}</td>
                <td>{r.status}</td>
                <td>{r.started_at || "-"}</td>
                <td>{r.finished_at || "-"}</td>
                <td>{r.items_ok}/{r.items_violation}</td>
                <td>
                  <Link to={`/stores/${id}/violations?run=${r.id}`}>Ver violações</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
