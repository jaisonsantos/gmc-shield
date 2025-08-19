import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ItemsApi } from "../lib/api";
import { useToast } from "../lib/toast";

export default function Items() {
  const { id } = useParams();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await ItemsApi.list(id, { limit: 50, page: 1 });
      setRows(data.items || data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/stores`}>&larr; Voltar</Link>
      </div>
      <h2>Itens do feed — Loja #{id}</h2>
      <button onClick={load} disabled={loading}>Recarregar</button>
      {loading ? (
        <div style={{ marginTop: 16 }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 16 }}>Nenhum item encontrado.</div>
      ) : (
        <table
          width="100%"
          cellPadding="8"
          style={{ borderCollapse: "collapse", marginTop: 12 }}
        >
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th>ID</th>
              <th>Título</th>
              <th>Link</th>
              <th>Preço</th>
              <th>Disponibilidade</th>
              <th>Brand</th>
              <th>GTIN/MPN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.item_id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={{ fontFamily: "monospace" }}>{it.item_id}</td>
                <td>{it.title}</td>
                <td>
                  {/^(https?:)?\/\//.test(it.link_canonical) ? (
                    <a href={it.link_canonical} target="_blank" rel="noreferrer">
                      abrir
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {it.currency} {(it.price_cents / 100).toFixed(2)}
                  {it.sale_price_cents
                    ? ` (sale ${(it.sale_price_cents / 100).toFixed(2)})`
                    : ""}
                </td>
                <td>{it.availability || "-"}</td>
                <td>{it.brand || "-"}</td>
                <td>{[it.gtin, it.mpn].filter(Boolean).join(" / ") || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
