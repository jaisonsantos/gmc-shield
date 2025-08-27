import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ItemsApi } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import {
  RefreshCw,
  Search,
  ChevronsLeft,
  ChevronLeft as PgPrev,
  ChevronRight as PgNext,
  ChevronsRight,
  ArrowUpWideNarrow,
  ArrowDownNarrowWide,
  ExternalLink,
  Clock,
} from "lucide-react";

const AvailabilityPill = ({ availability }) => {
  if (!availability) return "-";
  
  let className = '';
  switch (availability.toLowerCase()) {
    case 'in_stock':
      className = 'ok';
      break;
    case 'out_of_stock':
      className = 'off';
      break;
    case 'preorder':
      className = 'info';
      break;
    default:
      className = 'default';
  }
  return <span className={`status-pill ${className}`}>{availability.replace('_', ' ')}</span>;
};

const fmtMoney = (currency, cents) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: currency || "EUR" }).format((cents || 0) / 100);

const columns = [
  { key: "item_id", label: "ID", width: 120 },
  { key: "title", label: "Título", width: 280 },
  { key: "link_canonical", label: "Link", width: 70, noSort: true },
  { key: "price", label: "Preço" },
  { key: "availability", label: "Disponibilidade", width: 130 },
  { key: "brand", label: "Marca", width: 120 },
  { key: "gtin_mpn", label: "GTIN/MPN", width: 220, noSort: true },
];

export default function Items() {
  const { id } = useParams();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(null);
  const [pages, setPages] = useState(null);
  const [q, setQ] = useState("");
  const [typedQ, setTypedQ] = useState("");
  const [sort, setSort] = useState({ field: "item_id", dir: "asc" });

  const fetchItems = async (opts = {}) => {
    const params = { page, limit, q, sort: sort.field, dir: sort.dir, ...opts };
    setLoading(true);
    try {
      const res = await ItemsApi.list(id, params);
      const gotItems = res.items ?? res.data ?? res ?? [];
      setItems(gotItems);
      const t = res.total ?? res.total_count ?? null;
      const p = res.pages ?? (t && limit ? Math.ceil(t / limit) : null);
      setTotal(t);
      setPages(p);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchItems({ page: 1 });
  }, [id, limit, sort.field, sort.dir, q]);

  useEffect(() => {
    const t = setTimeout(() => setQ(typedQ.trim()), 300);
    return () => clearTimeout(t);
  }, [typedQ]);
  
  const onHeaderClick = (key) => {
    if (columns.find((c) => c.key === key)?.noSort) return;
    setSort((s) => (s.field === key ? { field: key, dir: s.dir === "asc" ? "desc" : "asc" } : { field: key, dir: "asc" }));
  };

  const viewRows = useMemo(() => {
    return items.map((it) => ({
      ...it,
      price: fmtMoney(it.currency, it.price_cents) + (it.sale_price_cents ? ` (sale ${fmtMoney(it.currency, it.sale_price_cents)})` : ""),
      gtin_mpn: [it.gtin, it.mpn].filter(Boolean).join(" / ") || "-",
    }));
  }, [items]);

  const canPrev = page > 1;
  const canNext = pages ? page < pages : items.length === limit;

  const goFirst = () => canPrev && setPage(1);
  const goPrev = () => canPrev && setPage((p) => Math.max(1, p - 1));
  const goNext = () => canNext && setPage((p) => p + 1);
  const goLast = () => pages && setPage(pages);

  useEffect(() => {
    fetchItems();
  }, [page]);

  return (
    <section className="card stack" style={{ gap: 24 }}>
      <h3>Itens do Feed</h3>
      
      <div className="table-toolbar">
        <div className="tt-left">
          <div className="search-wrap">
            <Search size={16} />
            <input
              className="input"
              placeholder="Buscar por título, ID, marca…"
              value={typedQ}
              onChange={(e) => setTypedQ(e.target.value)}
              style={{ minWidth: '300px' }}
            />
          </div>
        </div>
        <div className="tt-right">
          <Button variant="ghost" size="sm" onClick={() => fetchItems()}>
            <RefreshCw size={16} /> Recarregar
          </Button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => {
                const isActive = sort.field === c.key;
                const canSort = !c.noSort;
                return (
                  <th key={c.key} style={{ width: c.width }} className={canSort ? "th-sort" : ""} onClick={() => canSort && onHeaderClick(c.key)}>
                    <div className="th-cell">
                      <span>{c.label}</span>
                      {canSort && (isActive ? (sort.dir === "asc" ? <ArrowUpWideNarrow size={14} /> : <ArrowDownNarrowWide size={14} />) : <span className="sort-placeholder" />)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="td-center muted"><Clock size={16} style={{ marginRight: 6 }} />A carregar...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={columns.length} className="td-center muted">Nenhum item encontrado.</td></tr>
            ) : (
              viewRows.map((it) => (
                <tr key={it.item_id}>
                  <td className="mono">{it.item_id}</td>
                  <td>{it.title}</td>
                  <td>
                    {/^(https?:)?\/\//.test(it.link_canonical || "") ? (
                      <a href={it.link_canonical} target="_blank" rel="noreferrer" className="link">
                        abrir <ExternalLink size={12} style={{ marginLeft: 4, verticalAlign: "-2px" }} />
                      </a>
                    ) : "—"}
                  </td>
                  <td>{it.price}</td>
                  <td><AvailabilityPill availability={it.availability} /></td>
                  <td>{it.brand || "-"}</td>
                  <td className="mono">{it.gtin_mpn}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="tf-left">
          <label className="label" htmlFor="per-page" style={{marginBottom: 0}}>Itens por página</label>
            <select
              id="per-page"
              className="input"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {total && <span className="muted">| {total} itens no total</span>}
        </div>

        <div className="pager">
            <button className="icon-btn" onClick={goFirst} disabled={!canPrev || loading} title="Primeira"><ChevronsLeft size={16} /></button>
            <button className="icon-btn" onClick={goPrev} disabled={!canPrev || loading} title="Anterior"><PgPrev size={16} /></button>
            <div className="page-jump">
              <span>Página</span>
              <input type="number" className="input" value={page} min={1} max={pages || undefined} onChange={(e) => setPage(Math.max(1, Math.min(Number(e.target.value) || 1, pages || Infinity)))} onKeyDown={(e) => { if (e.key === "Enter") fetchItems(); }} style={{ width: 80 }} />
              {pages ? <span>de {pages}</span> : null}
            </div>
            <button className="icon-btn" onClick={goNext} disabled={!canNext || loading} title="Próxima"><PgNext size={16} /></button>
            <button className="icon-btn" onClick={goLast} disabled={!pages || loading || page === pages} title="Última"><ChevronsRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}