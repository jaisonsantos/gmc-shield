// web/src/pages/Feeds.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Feeds as Api } from "../lib/api";
import { useToast } from "../lib/toast";
import Button from "../components/Button";
import { Input } from "../components/Input";
import { FileUp, Link as LinkIcon, RefreshCw, CheckCircle2, Clock, UploadCloud } from "lucide-react";
import { useTranslation } from 'react-i18next';
import Toolbar from "../components/ui/Toolbar";
import { Table, THead, Th, TBody, Tr, Td } from "../components/ui/Table";


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
  const { t } = useTranslation();

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
      setFormatWarn(t('feeds.fileFormatMismatch', { detected: detected.toUpperCase(), selected: cfg.format.toUpperCase() }));
    } else {
      setFormatWarn("");
    }
  }, [file, cfg.format]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCfg = async () => {
    setLoading(true);
    try {
      await Api.configure(id, cfg);
      setSavedCfg(cfg);
      toast.success(t('feeds.configSaved'));
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const ingestUrl = async () => {
    if (!isValidUrl(cfg.url)) {
      setUrlError(true);
      return toast.error(t('feeds.invalidUrl'));
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
      toast.success(t('feeds.ingestOk', { count: res.items_imported || 0 }));
      await loadVersions();
      setHighlightNew(true);
      setShowNorm(true);
      setTimeout(() => firstRowRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const uploadAndIngest = async () => {
    if (!file) return toast.error(t('feeds.selectFile'));
    if (file.size > 10 * 1024 * 1024) return toast.error(t('feeds.fileTooLarge'));
    // Confirma se o arquivo indica formato diferente do select
    const detected = guessFormatFromFile(file);
    if (detected && detected !== cfg.format) {
      const ok = window.confirm(t('feeds.confirmMismatch', { detected: detected.toUpperCase(), selected: cfg.format.toUpperCase() }));
      if (!ok) return;
    }
    setLoading(true);
    try {
      const res = await Api.upload(id, file, cfg.format);
      toast.success(t('feeds.uploadOk', { count: res.items_imported || 0 }));
      setFile(null);
      await loadVersions();
      setHighlightNew(true);
      setShowNorm(true);
      setTimeout(() => firstRowRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error(e.status === 413 ? t('feeds.fileTooLarge') : e.message);
    } finally { setLoading(false); }
  };

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
    <div className="stack" style={{ gap: '24px' }}>
      {showNorm && (
        <div className="flex items-center gap-2 p-3 border rounded-md border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 size={18} /> {t('feeds.normalizedBanner')}
        </div>
      )}

      {/* Configurações */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
        <div className="text-base font-semibold">{t('feeds.configTitle')}</div>

        {/* Segmented control */}
        <div className="inline-flex items-center gap-2 p-1 bg-gray-100 border rounded-lg">
          <button type="button" className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md ${cfg.source_type === 'upload' ? 'bg-accent text-white' : 'bg-transparent'}`} onClick={() => setCfg({ ...cfg, source_type: 'upload', format: 'csv' })} disabled={loading}>
            <FileUp size={16} /> {t('feeds.tabUpload')}
          </button>
          <button type="button" className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md ${cfg.source_type === 'url' ? 'bg-accent text-white' : 'bg-transparent'}`} onClick={() => setCfg({ ...cfg, source_type: 'url', format: 'xml' })} disabled={loading}>
            <LinkIcon size={16} /> URL
          </button>
        </div>

        {/* Linha: Formato + Campo/Dropzone */}
        <div className="grid-2">
          <div>
            <label className="label">{t('feeds.format')}</label>
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
            <div className="helper">{cfg.format === "tsv" ? t('feeds.tsvHint') : t('feeds.xmlCsvHint')}</div>
          </div>

          {cfg.source_type === "upload" ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('feeds.file')}</label>
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} className={`relative border-2 border-dashed rounded-md p-6 flex items-center gap-3 ${dragOver ? 'bg-gray-50' : ''}`}>
                <UploadCloud size={28} />
                <div>
                  {t('feeds.dropHere')}<br />
                  <span className="text-sm text-gray-500">{t('feeds.dropHint')}</span>
                </div>
                <input type="file" accept={acceptFor(cfg.format)} onChange={(e) => onFilePicked(e.target.files?.[0] || null)} title="" className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              {file && <div className="text-sm text-gray-500 mt-1">{t('feeds.selected')}: <strong>{file.name}</strong></div>}
              {formatNote && <div className="text-sm text-gray-500 mt-1">{formatNote}</div>}
              {!formatNote && formatWarn && <div className="text-sm text-red-600 mt-1">{formatWarn}</div>}
            </div>
          ) : (
            <Input
              label="URL"
              placeholder={t('feeds.urlPlaceholder')}
              value={cfg.url}
              disabled={loading}
              onChange={(e) => { setCfg({ ...cfg, url: e.target.value }); setUrlError(false); }}
              onBlur={() => {
                const g = guessFormatFromUrl(cfg.url);
                if (g && g !== cfg.format) {
                  setCfg((c) => ({ ...c, format: g }));
                  setFormatNote(t('feeds.detectedFromUrl', { fmt: g.toUpperCase() }));
                }
              }}
              error={urlError ? t('feeds.invalidUrl') : ""}
              helper={t('feeds.urlHelper')}
            />
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          {cfg.source_type === "upload" ? (
            <Button onClick={uploadAndIngest} disabled={!file} loading={loading}>
              {t('feeds.uploadAndIngest')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={saveCfg} disabled={!isDirty || loading}>
                {t('feeds.saveConfig')}
              </Button>
              <Button onClick={ingestUrl} disabled={!isValidUrl(cfg.url)} loading={loading}>
                {t('feeds.ingestFromUrl')}
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Histórico */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
        <Toolbar
          left={<div className="text-base font-semibold">{t('feeds.history')}</div>}
          right={<Button variant="ghost" size="sm" onClick={loadVersions}><RefreshCw size={16} className="mr-1" /> {t('common.refresh')}</Button>}
        />

        {versions.length === 0 ? (
          <div className="inline-flex items-center gap-2 text-gray-500"><Clock size={18} />{t('feeds.noneYet')}</div>
        ) : (
          <Table>
            <THead>
              <Th>{t('feeds.when')}</Th>
              <Th>Hash</Th>
              <Th>{t('feeds.items')}</Th>
              <Th>{t('feeds.actions')}</Th>
            </THead>
            <TBody>
              {versions.map((v, i) => (
                <Tr key={v.hash} hover ref={i === 0 ? firstRowRef : null} className={highlightNew && i === 0 ? "bg-yellow-50" : ""}>
                  <Td><Clock size={14} className="opacity-60 mr-1 -translate-y-[2px] inline" />{new Date(v.created_at).toLocaleString()}</Td>
                  <Td mono>{v.hash.slice(0, 12)}…</Td>
                  <Td>{v.items_count}</Td>
                  <Td><Link to={`/app/stores/${id}/items`} className="text-accent dark:text-purple-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded">{t('feeds.viewItems')}</Link></Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
