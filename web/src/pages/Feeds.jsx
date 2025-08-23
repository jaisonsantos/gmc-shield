// web/src/pages/Feeds.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Feeds as Api } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import { Input } from "../components/Input";
import { Page, PageHeader, PageContent } from "../components/Page";
import { FileUp, Link as LinkIcon, RefreshCw, ChevronLeft, CheckCircle2, Clock, UploadCloud } from "lucide-react";

 
// ---- Formato: utilitários de detecção (ext/MIME/URL)
const FORMAT_EXTS = { csv: ["csv"], tsv: ["tsv", "tab"], xml: ["xml"] };

function acceptFor(fmt) {
  if (fmt === "csv") return ".csv";
  if (fmt === "tsv") return ".tsv,.tab";
  if (fmt === "xml") return ".xml";
  return ".csv,.tsv,.tab,.xml";
}

const MIME_MAP = {
  "text/csv": "csv",
  "application/vnd.ms-excel": "csv",
  "text/tab-separated-values": "tsv",
  "application/xml": "xml",
  "text/xml": "xml",
};
function extFromPath(path) {
  const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(path || "");
  return m?.[1]?.toLowerCase() || null;
}
function guessFormatFromExt(ext) {
  if (!ext) return null;
  for (const [fmt, exts] of Object.entries(FORMAT_EXTS)) {
    if (exts.includes(ext)) return fmt;
  }
  return null;
}
function guessFormatFromFile(file) {
  if (!file) return null;
  const byMime = MIME_MAP[file.type];
  if (byMime) return byMime;
  return guessFormatFromExt(extFromPath(file.name));
}
function guessFormatFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return guessFormatFromExt(extFromPath(u.pathname));
  } catch {
    return null;
  }
}

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
  const [dragOver, setDragOver] = useState(false);
  const [formatNote, setFormatNote] = useState(""); // exibe “detectei CSV e ajustei”
  const [formatWarn, setFormatWarn] = useState(""); // exibe divergência arquivo vs select
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isValidUrl = (s) => {
    try { new URL(s); return true; } catch { return false; }
  };

  // Mantém aviso quando o select diverge do formato detectado no arquivo
  useEffect(() => {
    if (!file) { setFormatWarn(""); return; }
    const detected = guessFormatFromFile(file);
    if (detected && detected !== cfg.format) {
      setFormatWarn(`O arquivo parece ${detected.toUpperCase()} mas o formato selecionado é ${cfg.format.toUpperCase()}.`);
    } else {
      setFormatWarn("");
    }
  }, [file, cfg.format]); // eslint-disable-line react-hooks/exhaustive-deps
 
  const saveCfg = async () => {
    setLoading(true);
    try {
      await Api.configure(id, cfg);
      setSavedCfg(cfg);
      toast.success("Configuração salva.");
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const ingestUrl = async () => {
    if (!isValidUrl(cfg.url)) {
      setUrlError(true);
      return toast.error("Informe uma URL válida do feed.");
    }
    // Confirma se a URL indica um formato diferente do select
    const g = guessFormatFromUrl(cfg.url);
    if (g && g !== cfg.format) {
      const ok = window.confirm(
        `A URL sugere ${g.toUpperCase()}, mas o formato selecionado é ${cfg.format.toUpperCase()}.\nDeseja prosseguir assim mesmo?`
      );
      if (!ok) return;
    }    
    setLoading(true);
    try {
      if (cfg.url !== savedCfg.url || cfg.format !== savedCfg.format || cfg.source_type !== savedCfg.source_type) {
        await Api.configure(id, cfg);
        setSavedCfg(cfg);
      }
      const res = await Api.ingestFromUrl(id);
      toast.success(`Ingestão OK: ${res.items_imported || 0} itens importados.`);
      await loadVersions();
      setHighlightNew(true);
      setShowNorm(true);
      setTimeout(() => firstRowRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const uploadAndIngest = async () => {
    if (!file) return toast.error("Selecione um arquivo.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB (limite do MVP).");
    // Confirma se o arquivo indica formato diferente do select
    const detected = guessFormatFromFile(file);
    if (detected && detected !== cfg.format) {
      const ok = window.confirm(
        `O arquivo parece ${detected.toUpperCase()}, mas o formato selecionado é ${cfg.format.toUpperCase()}.\nDeseja prosseguir assim mesmo?`
      );
      if (!ok) return;
    }
    setLoading(true);
    try {
      const res = await Api.upload(id, file, cfg.format);
      toast.success(`Upload e ingestão OK: ${res.items_imported || 0} itens importados.`);
      setFile(null);
      await loadVersions();
      setHighlightNew(true);
      setShowNorm(true);
      setTimeout(() => firstRowRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error(e.status === 413 ? "Arquivo acima do limite de 10 MB." : e.message);
    } finally { setLoading(false); }
  };

  const last = versions[0];
  const isDirty = cfg.url !== savedCfg.url || cfg.format !== savedCfg.format || cfg.source_type !== savedCfg.source_type;

  // Dropzone handlers
  const onFilePicked = (f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo acima de 10 MB (limite do MVP).");
      return;
    }
    setFile(f);
    const detected = guessFormatFromFile(f);
    if (detected && detected !== cfg.format) {
      setCfg((c) => ({ ...c, source_type: "upload", format: detected }));
      setFormatNote(`Detectei ${detected.toUpperCase()} pelo arquivo e ajustei o formato.`);
    } else {
      setFormatNote("");
    }
  };  
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    setCfg((c) => ({ ...c, source_type: "upload" }));
    onFilePicked(f);
  };

  return (
   <Page>
        <PageHeader>
        <div className="ph-left">
            <Link to="/stores" className="btn-link">
            <ChevronLeft size={16} style={{ marginRight: 6 }} /> Voltar
            </Link>
            <h2>Feed — Loja #{id}</h2>
        </div>
        {last && (
            <div className="ph-right">
            <span className="pill">
                Última: {timeAgo(last.created_at)} • {last.items_count} itens • {(last.format || cfg.format).toUpperCase()}
            </span>
            </div>
        )}
        </PageHeader>
      <PageContent>
        {showNorm && (
          <div className="banner ok">
            <CheckCircle2 size={18} /> Normalizado: preços em centavos, moeda detectada, links limpos.
          </div>
        )}

        {/* Configurações */}
        <section className="card stack">
          <div className="section-title">Configuração do Feed</div>

          {/* Segmented control */}
          <div className="segmented">
            <button
              type="button"
              className={cfg.source_type === "upload" ? "active" : ""}
              onClick={() => setCfg({ ...cfg, source_type: "upload", format: "csv" })}
              disabled={loading}
            >
              <FileUp size={16} /> Upload
            </button>
            <button
              type="button"
              className={cfg.source_type === "url" ? "active" : ""}
              onClick={() => setCfg({ ...cfg, source_type: "url", format: "xml" })}
              disabled={loading}
            >
              <LinkIcon size={16} /> URL
            </button>
          </div>

          {/* Linha: Formato + Campo/Dropzone */}
          <div className="grid-2">
            <div>
              <label className="label">Formato do feed</label>
              <select
                className="input"
                value={cfg.format}
                disabled={loading}
                onChange={(e) => setCfg({ ...cfg, format: e.target.value })}
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
              <div className="helper">
                {cfg.format === "tsv" ? "TSV usa Tab como delimitador." : "XML/CSV aceitos."}
              </div>
            </div>

            {cfg.source_type === "upload" ? (
              <div>
                <label className="label">Arquivo</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`dropzone ${dragOver ? "drag" : ""}`}
                >
                  <UploadCloud size={28} />
                  <div>
                    Arraste o arquivo aqui<br />
                    <span className="muted">ou clique para selecionar (CSV/TSV, máx. 10 MB)</span>
                  </div>
                  <input
                    type="file"
                    accept={acceptFor(cfg.format)}
                    onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
                    title=""
                  />
                </div>
                {file && <div className="muted" style={{ marginTop: 6 }}>Selecionado: <strong>{file.name}</strong></div>}
                {/* Mensagens de detecção/aviso para upload */}
                {formatNote && <div className="helper" style={{ marginTop: 6 }}>{formatNote}</div>}
                {!formatNote && formatWarn && <div className="error" style={{ marginTop: 6 }}>{formatWarn}</div>}
              </div>
            ) : (
              <Input
                label="URL do Feed"
                placeholder="https://exemplo.com/feed.xml"
                value={cfg.url}
                disabled={loading}
                onChange={(e) => { setCfg({ ...cfg, url: e.target.value }); setUrlError(false); }}
                onBlur={() => {
                  const g = guessFormatFromUrl(cfg.url);
                  if (g && g !== cfg.format) {
                    setCfg((c) => ({ ...c, format: g }));
                    setFormatNote(`Detectei ${g.toUpperCase()} pela URL e ajustei o formato.`);
                  }
                }}
                error={urlError ? "Informe uma URL válida." : ""}
                helper="Ex.: https://exemplo.com/feed.xml — UTM/gclid serão removidos."
              />
            )}
          </div>

          {/* Ações */}
          <div className="actions">
            {cfg.source_type === "upload" ? (
              <Button onClick={uploadAndIngest} disabled={!file} loading={loading}>
                Upload + Ingestão
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={saveCfg} disabled={!isDirty || loading}>
                  Salvar Configuração
                </Button>
                <Button onClick={ingestUrl} disabled={!isValidUrl(cfg.url)} loading={loading}>
                  Ingerir da URL
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Histórico */}
        <section className="card stack">
          <div className="section-head">
            <div className="section-title">Histórico de Versões</div>
            <Button variant="ghost" size="sm" onClick={loadVersions}>
              <RefreshCw size={16} style={{ marginRight: 6 }} /> Recarregar
            </Button>
          </div>

          {versions.length === 0 ? (
            <div className="empty">
              <Clock size={18} />
              Nenhuma versão ainda.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Hash</th>
                    <th>Itens</th>
                    <th style={{ width: 120 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v, i) => (
                    <tr key={v.hash} ref={i === 0 ? firstRowRef : null} className={highlightNew && i === 0 ? "row-new" : ""}>
                      <td><Clock size={14} style={{ opacity: .6, marginRight: 6, verticalAlign: "-2px" }} />{new Date(v.created_at).toLocaleString()}</td>
                      <td className="mono">{v.hash.slice(0, 12)}…</td>
                      <td>{v.items_count}</td>
                      <td>
                        <Link to={`/stores/${id}/items`} className="link">Ver itens</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PageContent>
    </Page>
  );
}
