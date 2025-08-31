// web/src/pages/Violations.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Violations as Api, Blocks } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import Button from "../components/Button";
import { RefreshCw, Clock, Ban, CheckCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Table, THead, Th, TBody, Tr, Td } from "../components/ui/Table";

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
  const { t } = useTranslation();

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
      toast.success(t('common.success'));
      await load();
    } catch (e) {
      toast.error(e.message || 'Block failed');
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
      toast.success(t('violations.unblocked', { id: feedItemId }));
      await load();
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
         <h3 className="text-lg font-semibold text-gray-800">{t('store.tabs.violations')}</h3>
         <Button variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={16} /> {t('common.refresh')}
          </Button>
      </div>

      {runId && <div className="inline-flex items-center gap-2 text-sm text-gray-600 mb-4">{t('violations.filterRun', { id: runId })}</div>}
      
      {err && <div className="text-red-600 mb-4">{err}</div>}
      <Table>
        <THead>
          <Th>ID</Th>
          <Th>{t('violations.rule')}</Th>
          <Th>{t('violations.severity')}</Th>
          <Th>{t('violations.feedItem')}</Th>
          <Th>{t('violations.message')}</Th>
          <Th>{t('violations.actions')}</Th>
        </THead>
        <TBody>
            {loading ? (
              <Tr><Td align="center" colSpan={6}><span className="text-gray-500"><Clock size={16} className="inline mr-2" />{t('common.loading')}</span></Td></Tr>
            ) : data.items.length === 0 ? (
              <Tr><Td align="center" colSpan={6}>—</Td></Tr>
            ) : (
              data.items.map((v) => {
                const isBlocked = !!blockedByItem[v.feed_item_id];
                return (
                  <Tr key={v.id}>
                    <Td mono>{v.id}</Td>
                    <Td mono>{v.rule_code}</Td>
                    <Td><span className={`inline-flex px-2 py-0.5 rounded text-xs ${v.severity === 'critical' ? 'bg-red-100 text-red-800' : v.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>{v.severity}</span></Td>
                    <Td mono>{v.feed_item_id || "-"}</Td>
                    <Td>{v.message}</Td>
                    <Td align="center">
                      {can("block") && v.feed_item_id && (
                        isBlocked ? (
                          <Button variant="outline" size="sm" disabled={busy === v.feed_item_id} onClick={() => unblockItem(v.feed_item_id)}>
                            <CheckCircle size={14} /> {busy === v.feed_item_id ? t('common.loading') : t('violations.unblock')}
                          </Button>
                        ) : (
                          <Button variant="solid" size="sm" disabled={busy === v.feed_item_id} onClick={() => blockItem(v.feed_item_id)}>
                            <Ban size={14} /> {busy === v.feed_item_id ? t('common.loading') : t('violations.block')}
                          </Button>
                        )
                      )}
                    </Td>
                  </Tr>
                );
              })
            )}
        </TBody>
      </Table>
    </section>
  );
}
