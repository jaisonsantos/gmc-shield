import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Feeds as Api } from "../lib/api";
import { useToast } from "../lib/toast";

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export default function Feeds() {
  const { id } = useParams();
  const toast = useToast();

  const [cfg, setCfg] = useState({ source_type: "upload", url: "", format: "csv" });
  const [savedCfg, setSavedCfg] = useState({ source_type: "upload", url: "", format: "csv" });
  const [file, setFile] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightNew, setHighlightNew] = useState(false);
  const [showNorm, setShowNorm] = useState(false);
  const [urlError, setUrlError] = useState(false);
  const firstRowRef = useRef(null);

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
      setSavedCfg(cfg);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const isValidUrl = (s) => {
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  };

  const ingestUrl = async () => {
    if (!isValidUrl(cfg.url)) {
      setUrlError(true);
      return toast.error("Informe a URL do feed.");
    }
    setLoading(true);
    try {
      if (cfg.url !== savedCfg.url || cfg.format !== savedCfg.format || cfg.source_type !== savedCfg.source_type) {
        await Api.configure(id, cfg);
        setSavedCfg(cfg);
      }
      const res = await Api.ingestFromUrl(id);
      toast.success(`Ingest OK: ${res.items_imported || 0} itens`);
      await loadVersions();
      setHighlightNew(true);
      setShowNorm(true);
      setTimeout(() => firstRowRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadAndIngest = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB (limite do MVP)");
    setLoading(true);
    try {
      const res = await Api.upload(id, file, cfg.format);
      toast.success(`Upload+ingest OK: ${res.items_imported || 0} itens`);
      setFile(null);
      await loadVersions();
      setHighlightNew(true);
      setShowNorm(true);
      setTimeout(() => firstRowRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      if (e.status === 413) toast.error("Arquivo acima do limite de 10 MB.");
      else toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const last = versions[0];
  const formatSelect = (
    <select
      value={cfg.format}
      disabled={loading}
      onChange={(e) => setCfg({ ...cfg, format: e.target.value })}
      style={{ width: "100%" }}
      title={cfg.format === "tsv" ? "TSV usa Tab como delimitador" : ""}
    >
      {cfg.source_type === "url" ? (
        <>
          <option value="xml">XML</option>
          <option value="csv">CSV</option>
          <option value="tsv">TSV</option>
        </>
      ) : (
        <>
          <option value="csv">CSV</option>
          <option value="tsv">TSV</option>
          <option value="xml">XML</option>
        </>
      )}
    </select>
  );

  const isDirty =
    cfg.url !== savedCfg.url || cfg.format !== savedCfg.format || cfg.source_type !== savedCfg.source_type;

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/stores`}>&larr; Voltar</Link>
      </div>
      <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Feed — Loja #{id}</span>
        {last && (
          <small style={{ color: "#555" }}>
            Última importação: {timeAgo(last.created_at)} • {last.items_count} itens •
            {(last.format || cfg.format).toUpperCase()}
          </small>
        )}
      </h2>
      {showNorm && (
        <div style={{ marginTop: 8 }}>
          <span style={{ background: "#eef", padding: "2px 6px", borderRadius: 4 }}>
            Normalizado: preços em centavos, moeda detectada, links limpos
          </span>
        </div>
      )}
      <p style={{ marginTop: 16, color: "#555" }}>
        1. Escolha a origem (Upload ou URL).<br />2. Se for URL, salve e clique “Ingest a partir da
        URL”.<br />3. Se for Upload, selecione o arquivo e clique “Upload + Ingest”.
      </p>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <div>
          <label>Origem do feed</label>
          <div style={{ display: "inline-flex", border: "1px solid #ccc", borderRadius: 4, overflow: "hidden" }}>
            <button
              onClick={() => setCfg({ ...cfg, source_type: "upload", format: "csv" })}
              style={{
                padding: "4px 12px",
                border: "none",
                background: cfg.source_type === "upload" ? "#ddd" : "#fff",
              }}
              disabled={loading}
            >
              Upload
            </button>
            <button
              onClick={() => setCfg({ ...cfg, source_type: "url", format: "xml" })}
              style={{
                padding: "4px 12px",
                border: "none",
                background: cfg.source_type === "url" ? "#ddd" : "#fff",
              }}
              disabled={loading}
            >
              URL
            </button>
          </div>
        </div>

        {cfg.source_type === "upload" ? (
          <div style={{ marginTop: 12 }}>
            <div>
              <label>Formato</label>
              {formatSelect}
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                type="file"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 10 * 1024 * 1024) {
                    setFile(null);
                    toast.error("Arquivo acima de 10 MB (limite do MVP)");
                  } else {
                    setFile(f || null);
                  }
                }}
              />
              <div style={{ color: "#666", fontSize: 12 }}>
                CSV/TSV delimitado por vírgula/Tab. Tamanho máx. 10 MB.
              </div>
            </div>
            <button
              onClick={uploadAndIngest}
              disabled={loading || !file}
              title={!file ? "Selecione um arquivo primeiro" : ""}
              style={{ marginTop: 12 }}
            >
              {loading ? "Processando…" : "Upload + Ingest"}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div>
              <label>Formato</label>
              {formatSelect}
            </div>
            <div style={{ marginTop: 8 }}>
              <label>URL do feed</label>
              <input
                placeholder="https://exemplo.com/feed.xml"
                value={cfg.url}
                disabled={loading}
                onChange={(e) => {
                  setCfg({ ...cfg, url: e.target.value });
                  setUrlError(false);
                }}
                style={{ width: "100%", border: urlError ? "1px solid red" : undefined }}
              />
              <div style={{ color: "#666", fontSize: 12 }}>
                Ex.: https://exemplo.com/feed.xml — UTM/gclid serão removidos.
              </div>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={saveCfg} disabled={loading || !isDirty}>
                Salvar
              </button>
              <button
                onClick={ingestUrl}
                disabled={loading || !isValidUrl(cfg.url)}
                title={!isValidUrl(cfg.url) ? "Informe a URL" : ""}
              >
                {loading ? "Processando…" : "Ingest a partir da URL"}
              </button>
            </div>
          </div>
        )}
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v, i) => (
                <tr
                  key={i}
                  ref={i === 0 ? firstRowRef : null}
                  style={{
                    borderBottom: "1px solid #f3f3f3",
                    background: highlightNew && i === 0 ? "#fffbdd" : undefined,
                  }}
                >
                  <td>{new Date(v.created_at).toLocaleString()}</td>
                  <td style={{ fontFamily: "monospace" }}>{v.hash.slice(0, 12)}…</td>
                  <td>{v.items_count}</td>
                  <td>
                    <Link to={`/stores/${id}/items`}>Ver itens</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
