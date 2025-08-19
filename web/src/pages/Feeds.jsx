import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Feeds as Api } from "../lib/api";
import { useToast } from "../lib/toast";

export default function Feeds() {
  const { id } = useParams();
  const toast = useToast();

  const [cfg, setCfg] = useState({ source_type: "url", url: "", format: "xml" });
  const [file, setFile] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadVersions = async () => {
    try {
      const data = await Api.versions(id);
      setVersions(data.items || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [id]);

  const saveCfg = async () => {
    try {
      await Api.configure(id, cfg);
      toast.success("Configuração salva.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const ingestUrl = async () => {
    setLoading(true);
    try {
      const res = await Api.ingestFromUrl(id);
      toast.success(`Ingest OK: ${res.items_imported || 0} itens`);
      await loadVersions();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadAndIngest = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    setLoading(true);
    try {
      const res = await Api.upload(id, file, cfg.format);
      toast.success(`Upload+ingest OK: ${res.items_imported || 0} itens`);
      setFile(null);
      await loadVersions();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/stores`}>&larr; Voltar</Link>
      </div>
      <h2>Feed — Loja #{id}</h2>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <h3>Configuração</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label>Source Type</label>
            <select
              value={cfg.source_type}
              onChange={(e) => setCfg({ ...cfg, source_type: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="url">URL</option>
              <option value="upload">Upload</option>
            </select>
          </div>
          <div>
            <label>Formato</label>
            <select
              value={cfg.format}
              onChange={(e) => setCfg({ ...cfg, format: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="xml">XML</option>
              <option value="csv">CSV</option>
              <option value="tsv">TSV</option>
            </select>
          </div>
          <div>
            <label>URL do feed (se usar URL)</label>
            <input
              placeholder="https://exemplo.com/feed.xml"
              value={cfg.url}
              onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={saveCfg}>Salvar</button>
          <button onClick={ingestUrl} disabled={loading || cfg.source_type !== "url"}>
            Ingest a partir da URL
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <h3>Upload rápido</h3>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={uploadAndIngest} disabled={loading || !file}>Upload + Ingest</button>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Histórico de versões</h3>
          <button onClick={loadVersions}>Recarregar</button>
        </div>
        {versions.length === 0 ? (
          <div>Nenhuma versão ainda.</div>
        ) : (
          <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th>Quando</th>
                <th>Hash</th>
                <th>Itens</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td>{new Date(v.created_at).toLocaleString()}</td>
                  <td style={{ fontFamily: "monospace" }}>{v.hash.slice(0, 12)}…</td>
                  <td>{v.items_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
