import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { WP as Api } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import Input, { Textarea } from "../components/Input";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { useTranslation } from 'react-i18next';

export default function WPIntegration() {
  const { id } = useParams();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [creds, setCreds] = useState({ wp_api_base: "", wp_base_url: "", wp_user: "", wp_app_password: "" });
  const [policy, setPolicy] = useState({ type: "refund", content_md: "" });
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const loadStatus = async () => {
    try {
      const s = await Api.status(id);
      setStatus(s);
      setCreds((c) => ({
        ...c,
        wp_api_base: s.wp_api_base || "",
        wp_base_url: s.site || "",
        wp_user: s.wp_user || "",
      }));
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveCreds = async () => {
    if (!creds.wp_api_base || !creds.wp_user || !creds.wp_app_password) {
      toast.error(t('wp.missingCreds'));
      return;
    }
    try {
      setBusy(true);
      await Api.saveCreds(id, creds);
      toast.success(t('common.success'));
      await loadStatus();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const renderPreview = async () => {
    try {
      const res = await Api.renderPolicy(id, policy);
      setPreviewHtml(res.html);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const publish = async () => {
    if (!policy.content_md.trim()) {
      toast.error(t('wp.contentEmpty'));
      return;
    }
    try {
      setBusy(true);
      await Api.publishPolicy(id, policy);
      toast.success(t('wp.published'));
      setPreviewHtml("");
      await loadStatus();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const syncBlocks = async () => {
    try {
      setBusy(true);
      const res = await Api.syncBlocks(id);
      toast.success(`Sync: ${res.synced}/${res.total}`);
      await loadStatus();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Credenciais */}
      <Card>
        <SectionHeader title={t('wp.credentials')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t('wp.apiBase')} placeholder="http://localhost:8080/wp-json" value={creds.wp_api_base} onChange={(e) => setCreds({ ...creds, wp_api_base: e.target.value })} />
          <Input label={t('wp.publicSite')} placeholder="http://localhost:8080" value={creds.wp_base_url} onChange={(e) => setCreds({ ...creds, wp_base_url: e.target.value })} />
          <Input label={t('wp.user')} placeholder="admin" value={creds.wp_user} onChange={(e) => setCreds({ ...creds, wp_user: e.target.value })} />
          <Input label={t('wp.appPassword')} type="password" placeholder="xxxx xxxx xxxx ..." value={creds.wp_app_password} onChange={(e) => setCreds({ ...creds, wp_app_password: e.target.value })} />
        </div>
        <div className="mt-3">
          <Button onClick={saveCreds} loading={busy}>{t('wp.saveAndTest')}</Button>
        </div>
      </Card>

      {/* Policies */}
      <Card>
        <SectionHeader title={t('wp.policies')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('wp.type')}</label>
            <select className="px-2 py-1 border border-gray-300 rounded-md" value={policy.type} onChange={(e) => setPolicy({ ...policy, type: e.target.value })}>
              <option value="refund">{t('policies.refund')}</option>
              <option value="shipping">{t('policies.shipping')}</option>
              <option value="privacy">{t('policies.privacy')}</option>
            </select>
          </div>
          <div />
          <Textarea label={t('wp.contentMd')} rows={10} value={policy.content_md} onChange={(e) => setPolicy({ ...policy, content_md: e.target.value })} />
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          <Button variant="outline" onClick={renderPreview}>{t('common.preview')}</Button>
          <Button onClick={publish} loading={busy}>{t('common.publish')}</Button>
        </div>
        {previewHtml && (
          <div className="mt-3 p-3 border rounded-md" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}
      </Card>

      {/* Bloqueios */}
      <Card>
        <SectionHeader title="Blocks" />
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={syncBlocks} loading={busy}>{t('common.sync')}</Button>
          {status?.last_block_sync_at && (
            <span className="text-sm text-gray-500">
              {t('wp.lastSync')} {new Date(status.last_block_sync_at).toLocaleString()} ({status.last_block_synced})
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
