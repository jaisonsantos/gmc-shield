// web/src/pages/Items.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ItemsApi } from "../lib/api";
import { useToast } from "../lib/toast";
import { Page, PageHeader, PageContent } from "../components/Page";
import Button from "../components/Button";
import { Input } from "../components/Input";
import {
  ChevronLeft,
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

/* helpers */
const fmtMoney = (currency, cents) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: currency || "EUR" }).format((cents || 0) / 100);

const columns = [
  { key: "item_id", label: "ID", width: 120 },
  { key: "title", label: "Título", width: 280 },
  { key: "link_canonical", label: "Link", width: 70, noSort: true },
  { key: "price", label: "Preço" },
  { key: "availability", label: "Disponibilidade", width: 130 },
  { key: "brand", label: "Brand", width: 120 },
  { key: "gtin_mpn", label: "GTIN/MPN", width: 220, noSort: true },
];

export default function Items() {
  const { id } = useParams();
  const toast = useToast();

  // estado de dados
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // estado de paginação/controle
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(null); // se a API devolver
  const [pages, setPages] = useState(null); // idem

  // estado de busca/ordenação
  const [q, setQ] = useState("");
  const [typedQ, setTypedQ] = useState("");
  const [sort, setSort] = useState({ field: "item_id", dir: "asc" }); // asc|desc

  // carrega tabela
  const fetchItems = async (opts = {}) => {
    const params = {
      page,
      limit,
      q,
      sort: sort.field,
      dir: sort.dir,
      ...opts,
    };
    setLoading(true);
    try {
      const res = await ItemsApi.list(id, params);

      // compat com diferentes formatos
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

  // inicial / quando id muda
  useEffect(() => {
    setPage(1);
    fetchItems({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, limit, sort.field, sort.dir, q]);

  // debounce da busca (300ms)
  useEffect(() => {
    const t = setTimeout(() => setQ(typedQ.trim()), 300);
    return () => clearTimeout(t);
  }, [typedQ]);

  const onHeaderClick = (key) => {
    if (columns.find((c) => c.key === key)?.noSort) return;
    setSort((s) =>
      s.field === key ? { field: key, dir: s.dir === "asc" ? "desc" : "asc" } : { field: key, dir: "asc" }
    );
  };

  // fallback: se o backend não ordenar, ordena client-side só para exibição
  const viewRows = useMemo(() => {
    const rows = items.map((it) => ({
      ...it,
      price: fmtMoney(it.currency, it.price_cents) + (it.sale_price_cents ? ` (sale ${fmtMoney(it.currency, it.sale_price_cents)})` : ""),
      gtin_mpn: [it.gtin, it.mpn].filter(Boolean).join(" / ") || "-",
    }));
    // se total/páginas vieram, assumimos que o servidor já ordenou
    if (total || pages) return rows;
    if (!sort?.field) return rows;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = (a[sort.field] ?? "").toString().toLowerCase();
      const vb = (b[sort.field] ?? "").toString().toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [items, sort, total, pages]);

  const canPrev = page > 1;
  const canNext = pages ? page < pages : items.length === limit; // fallback sem total

  const goFirst = () => canPrev && setPage(1);
  const goPrev = () => canPrev && setPage((p) => Math.max(1, p - 1));
  const goNext = () => canNext && setPage((p) => p + 1);
  const goLast = () => pages && setPage(pages);

  useEffect(() => {
    // quando trocar de page via controles
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <Page>
      <PageHeader>
        <div className="header-main">
          <Link to="/app/stores" className="btn-link">
            <ChevronLeft size={16} style={{ marginRight: 6 }} /> Voltar
          </Link>
          <h2>Itens do feed — Loja #{id}</h2>
        </div>
        <span className="pill meta">
          {total != null ? `${total} itens` : `Página ${page}${pages ? ` / ${pages}` : ""}`}
        </span>
      </PageHeader>

      <PageContent>
        {/* Toolbar */}
        <section className="card stack" style={{ gap: 12 }}>
          <div className="table-toolbar">
            <div className="tt-left">
              <div className="search-wrap">
                <Search size={16} />
                <input
                  className="input"
                  placeholder="Buscar por título, ID, brand…"
                  value={typedQ}
                  onChange={(e) => setTypedQ(e.target.value)}
                />
              </div>

              <div className="tt-field">
                <label className="label" htmlFor="per-page">Por página</label>
                <select
                  id="per-page"
                  className="input"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tt-right">
              <Button variant="ghost" size="sm" onClick={() => fetchItems()}>
                <RefreshCw size={16} style={{ marginRight: 6 }} /> Recarregar
              </Button>

              {/* paginação */}
              <div className="pager">
                <button className="icon-btn" onClick={goFirst} disabled={!canPrev || loading} title="Primeira">
                  <ChevronsLeft size={16} />
                </button>
                <button className="icon-btn" onClick={goPrev} disabled={!canPrev || loading} title="Anterior">
                  <PgPrev size={16} />
                </button>

                <div className="page-jump">
                  <span>Página</span>
                  <input
                    type="number"
                    className="input"
                    value={page}
                    min={1}
                    max={pages || undefined}
                    onChange={(e) => setPage(Math.max(1, Math.min(Number(e.target.value) || 1, pages || Infinity)))}
                    onKeyDown={(e) => { if (e.key === "Enter") fetchItems(); }}
                    style={{ width: 80 }}
                  />
                  {pages ? <span>de {pages}</span> : null}
                </div>

                <button className="icon-btn" onClick={goNext} disabled={!canNext || loading} title="Próxima">
                  <PgNext size={16} />
                </button>
                <button className="icon-btn" onClick={goLast} disabled={!pages || loading || page === pages} title="Última">
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => {
                    const isActive = sort.field === c.key;
                    const canSort = !c.noSort;
                    return (
                      <th
                        key={c.key}
                        style={{ width: c.width }}
                        className={canSort ? "th-sort" : ""}
                        onClick={() => canSort && onHeaderClick(c.key)}
                      >
                        <div className="th-cell">
                          <span>{c.label}</span>
                          {canSort && (
                            isActive ? (
                              sort.dir === "asc" ? <ArrowUpWideNarrow size={14} /> : <ArrowDownNarrowWide size={14} />
                            ) : <span className="sort-placeholder" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="td-center muted">
                      <Clock size={16} style={{ marginRight: 6 }} />
                      Carregando…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="td-center muted">Nenhum item encontrado.</td>
                  </tr>
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
                      <td>{it.availability || "-"}</td>
                      <td>{it.brand || "-"}</td>
                      <td className="mono">{it.gtin_mpn}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </PageContent>
    </Page>
  );
}
