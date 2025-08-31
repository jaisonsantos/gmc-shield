import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ItemsApi } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import { useTranslation } from 'react-i18next';
import { formatCurrency, getNavigatorLocale } from "../lib/format";
import Toolbar from "../components/ui/Toolbar";
import { Table, THead, Th, TBody, Tr, Td } from "../components/ui/Table";
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

const fmtMoney = (currency, cents) => formatCurrency(cents || 0, currency || 'EUR', getNavigatorLocale());

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
  const { t } = useTranslation();

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
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">{t('items.title')}</h3>
      
      <Toolbar
        left={
          <div className="relative">
            <Search size={16} className="absolute left-2 top-2.5 text-gray-500" />
            <input
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-md min-w-[300px] focus:outline-none focus:ring-2 focus:ring-accent/50"
              placeholder={t('items.searchPlaceholder')}
              value={typedQ}
              onChange={(e) => setTypedQ(e.target.value)}
            />
          </div>
        }
        right={
          <Button variant="ghost" size="sm" onClick={() => fetchItems()}>
            <RefreshCw size={16} /> {t('common.refresh')}
          </Button>
        }
      />

      <Table>
        <THead>
          {columns.map((c) => {
            const isActive = sort.field === c.key;
            const canSort = !c.noSort;
            return (
              <Th key={c.key} align="left">
                <div className={`flex items-center gap-1 ${canSort ? 'cursor-pointer select-none' : ''}`} onClick={() => canSort && onHeaderClick(c.key)}>
                  <span>{c.label}</span>
                  {canSort && (isActive ? (sort.dir === "asc" ? <ArrowUpWideNarrow size={14} /> : <ArrowDownNarrowWide size={14} />) : <span className="inline-block w-3 h-3 opacity-0" />)}
                </div>
              </Th>
            );
          })}
        </THead>
        <TBody>
            {loading ? (
              <Tr><Td align="center" colSpan={columns.length}><span className="text-gray-500"><Clock size={16} className="inline mr-2" />{t('common.loading')}</span></Td></Tr>
            ) : items.length === 0 ? (
              <Tr><Td align="center" colSpan={columns.length}><span className="text-gray-500">{t('items.empty')}</span></Td></Tr>
            ) : (
              viewRows.map((it) => (
                <Tr key={it.item_id}>
                  <Td mono>{it.item_id}</Td>
                  <Td>{it.title}</Td>
                  <Td>
                    {/^(https?:)?\/\//.test(it.link_canonical || "") ? (
                      <a href={it.link_canonical} target="_blank" rel="noreferrer" className="text-accent dark:text-purple-300 hover:underline inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded">
                        {t('items.open')} <ExternalLink size={12} className="ml-1 -translate-y-[1px]" />
                      </a>
                    ) : "—"}
                  </Td>
                  <Td>{it.price}</Td>
                  <Td><AvailabilityPill availability={it.availability} /></Td>
                  <Td>{it.brand || "-"}</Td>
                  <Td mono>{it.gtin_mpn}</Td>
                </Tr>
              ))
            )}
        </TBody>
      </Table>

      <div className="flex flex-wrap justify-between items-center gap-3 pt-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <label htmlFor="per-page" className="text-xs">{t('items.perPage')}</label>
          <select id="per-page" className="px-2 py-1 border border-gray-300 rounded-md" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {total && <span className="text-gray-500">| {t('items.total', { count: total })}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 border border-gray-300 rounded-md flex items-center justify-center disabled:opacity-60" onClick={goFirst} disabled={!canPrev || loading} title={t('pager.first')}><ChevronsLeft size={16} /></button>
          <button className="w-8 h-8 border border-gray-300 rounded-md flex items-center justify-center disabled:opacity-60" onClick={goPrev} disabled={!canPrev || loading} title={t('pager.prev')}><PgPrev size={16} /></button>
          <div className="flex items-center gap-2">
            <span>{t('pager.page')}</span>
            <input type="number" className="w-20 px-2 py-1 border border-gray-300 rounded-md" value={page} min={1} max={pages || undefined} onChange={(e) => setPage(Math.max(1, Math.min(Number(e.target.value) || 1, pages || Infinity)))} onKeyDown={(e) => { if (e.key === "Enter") fetchItems(); }} />
            {pages ? <span>{t('pager.of', { total: pages })}</span> : null}
          </div>
          <button className="w-8 h-8 border border-gray-300 rounded-md flex items-center justify-center disabled:opacity-60" onClick={goNext} disabled={!canNext || loading} title={t('pager.next')}><PgNext size={16} /></button>
          <button className="w-8 h-8 border border-gray-300 rounded-md flex items-center justify-center disabled:opacity-60" onClick={goLast} disabled={!pages || loading || page === pages} title={t('pager.last')}><ChevronsRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}
