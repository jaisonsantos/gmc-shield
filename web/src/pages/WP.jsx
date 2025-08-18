import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WP as Api } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import Input, { Textarea } from "../components/Input";

export default function WPIntegration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [creds, setCreds] = useState({ wp_api_base: "", wp_base_url: "", wp_user: "", wp_app_password: "" });
  const [policy, setPolicy] = useState({ type: "refund", content_md: "" });
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);

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
      toast.error("Preencha API base, usuário e App Password.");
      return;
    }
    try {
      setBusy(true);
      await Api.saveCreds(id, creds);
      toast.success("Credenciais salvas.");
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
      toast.error("Conteúdo da política está vazio.");
      return;
    }
    try {
      setBusy(true);
      await Api.publishPolicy(id, policy);
      toast.success("Publicado.");
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

  const backTo = id ? `/stores/${id}` : "/stores";

  return (
    <div>
      {/* Header com Voltar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="outline" onClick={() => navigate(backTo)}>← Voltar</Button>
          <h2 style={{ margin: 0 }}>Integração WordPress</h2>
        </div>
      </div>

      <div className="grid stack">
        {/* Credenciais */}
        <section className="section stack">
          <h3>Credenciais</h3>
          <div className="grid grid-2">
            <Input
              label="API base (REST do WP)"
              placeholder="http://localhost:8080/wp-json"
              value={creds.wp_api_base}
              onChange={(e) => setCreds({ ...creds, wp_api_base: e.target.value })}
            />
            <Input
              label="Site público (base_url)"
              placeholder="http://localhost:8080"
              value={creds.wp_base_url}
              onChange={(e) => setCreds({ ...creds, wp_base_url: e.target.value })}
            />
            <Input
              label="Usuário (WP)"
              placeholder="admin"
              value={creds.wp_user}
              onChange={(e) => setCreds({ ...creds, wp_user: e.target.value })}
            />
            <Input
              label="App Password (WP)"
              type="password"
              placeholder="xxxx xxxx xxxx ..."
              value={creds.wp_app_password}
              onChange={(e) => setCreds({ ...creds, wp_app_password: e.target.value })}
            />
          </div>
          <div className="actions-sticky">
            <Button variant="outline" onClick={() => navigate(backTo)}>Cancelar</Button>
            <Button onClick={saveCreds} loading={busy}>Salvar & Testar</Button>
          </div>
        </section>

        {/* Policies */}
        <section className="section stack">
          <h3>Policies</h3>
          <div className="grid grid-2">
            <div>
              <label className="label">Tipo</label>
              <select
                className="input"
                value={policy.type}
                onChange={(e) => setPolicy({ ...policy, type: e.target.value })}
              >
                <option value="refund">Refund</option>
                <option value="shipping">Shipping</option>
                <option value="privacy">Privacy</option>
              </select>
            </div>
            <div />
            <Textarea
              label="Conteúdo (Markdown)"
              rows={10}
              value={policy.content_md}
              onChange={(e) => setPolicy({ ...policy, content_md: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={renderPreview}>Preview</Button>
            <Button onClick={publish} loading={busy}>Publicar</Button>
          </div>
          {previewHtml && (
            <div className="card" style={{ padding: 12 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </section>

        {/* Bloqueios */}
        <section className="section stack">
          <h3>Bloqueios</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="outline" onClick={syncBlocks} loading={busy}>Sync agora</Button>
            {status?.last_block_sync_at && (
              <span className="helper">
                Último sync: {new Date(status.last_block_sync_at).toLocaleString()} ({status.last_block_synced})
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
