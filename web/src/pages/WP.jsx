import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { WP as Api } from "../lib/api";
import { useToast } from "../lib/toast";

export default function WPIntegration() {
  const { id } = useParams();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [creds, setCreds] = useState({ wp_api_base: "", wp_base_url: "", wp_user: "", wp_app_password: "" });
  const [policy, setPolicy] = useState({ type: "refund", content_md: "" });
  const [previewHtml, setPreviewHtml] = useState("");

  const loadStatus = async () => {
    try {
      const s = await Api.status(id);
      setStatus(s);
      setCreds((c) => ({ ...c, wp_api_base: s.wp_api_base || "", wp_base_url: s.site || "", wp_user: s.wp_user || "" }));
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => { loadStatus(); }, [id]);

  const saveCreds = async () => {
    try {
      await Api.saveCreds(id, creds);
      toast.success("Credenciais salvas.");
      await loadStatus();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const renderPreview = async () => {
    try {
      const res = await Api.renderPolicy(id, policy);
      setPreviewHtml(res.html);
    } catch (e) { toast.error(e.message); }
  };

  const publish = async () => {
    try {
      await Api.publishPolicy(id, policy);
      toast.success("Publicado.");
      setPreviewHtml("");
      await loadStatus();
    } catch (e) { toast.error(e.message); }
  };

  const syncBlocks = async () => {
    try {
      const res = await Api.syncBlocks(id);
      toast.success(`Sync: ${res.synced}/${res.total}`);
      await loadStatus();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ maxWidth: 800, margin: "24px auto", padding: 16 }}>
      <h2>WordPress Integration</h2>

      <section style={{ marginBottom: 32 }}>
        <h3>Credenciais</h3>
        <input placeholder="API base" value={creds.wp_api_base} onChange={e=>setCreds({...creds, wp_api_base: e.target.value})} style={{display:'block', width:'100%', marginBottom:8}} />
        <input placeholder="Site público" value={creds.wp_base_url} onChange={e=>setCreds({...creds, wp_base_url: e.target.value})} style={{display:'block', width:'100%', marginBottom:8}} />
        <input placeholder="Usuário" value={creds.wp_user} onChange={e=>setCreds({...creds, wp_user: e.target.value})} style={{display:'block', width:'100%', marginBottom:8}} />
        <input placeholder="App Password" type="password" value={creds.wp_app_password} onChange={e=>setCreds({...creds, wp_app_password: e.target.value})} style={{display:'block', width:'100%', marginBottom:8}} />
        <button onClick={saveCreds}>Salvar & Testar</button>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Policies</h3>
        <select value={policy.type} onChange={e=>setPolicy({...policy, type: e.target.value})}>
          <option value="refund">Refund</option>
          <option value="shipping">Shipping</option>
          <option value="privacy">Privacy</option>
        </select>
        <textarea rows="6" style={{display:'block', width:'100%', marginTop:8}} value={policy.content_md} onChange={e=>setPolicy({...policy, content_md:e.target.value})}></textarea>
        <div style={{ marginTop:8 }}>
          <button onClick={renderPreview}>Preview</button>
          <button onClick={publish} style={{ marginLeft:8 }}>Publicar</button>
        </div>
        {previewHtml && <div style={{border:'1px solid #ccc', padding:8, marginTop:8}} dangerouslySetInnerHTML={{__html:previewHtml}}></div>}
      </section>

      <section>
        <h3>Bloqueios</h3>
        <button onClick={syncBlocks}>Sync agora</button>
        {status && status.last_block_sync_at && (
          <span style={{ marginLeft:8 }}>Último sync: {new Date(status.last_block_sync_at).toLocaleString()} ({status.last_block_synced})</span>
        )}
      </section>
    </div>
  );
}
