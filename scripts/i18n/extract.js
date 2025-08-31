#!/usr/bin/env node
/**
 * Minimal extractor: scans web/src for t('key') and prints a sorted list.
 * Writes missing keys files under web/src/i18n/locales/[lang]/missing.json
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'web', 'src');
const LOCALES_DIR = path.join(SRC, 'i18n', 'locales');

/** Collect keys used by t('...') or t("...") */
function collectKeys(dir) {
  const keys = new Set();
  (function walk(p) {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const fp = path.join(p, e.name);
      if (e.isDirectory()) walk(fp);
      else if (/\.(jsx?|tsx?)$/.test(e.name)) {
        const text = fs.readFileSync(fp, 'utf8');
        const re = /\bt\(["'`]([^"'`)]+)["'`]/g;
        let m;
        while ((m = re.exec(text))) keys.add(m[1]);
      }
    }
  })(dir);
  return Array.from(keys).sort();
}

function loadJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return {}; }
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function writeMissing(keys) {
  const langs = fs.readdirSync(LOCALES_DIR).filter((d) => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory());
  for (const lang of langs) {
    const common = loadJson(path.join(LOCALES_DIR, lang, 'common.json'));
    const dict = flatten(common);
    const missing = {};
    for (const k of keys) {
      if (!(k in dict)) missing[k] = '';
    }
    const outDir = path.join(LOCALES_DIR, lang);
    const outFile = path.join(outDir, 'missing.json');
    fs.writeFileSync(outFile, JSON.stringify(missing, null, 2));
    console.log(`${lang} missing: ${Object.keys(missing).length}`);
  }
}

const keys = collectKeys(SRC);
writeMissing(keys);
console.log('Extraction complete');
