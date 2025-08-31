import React from 'react';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';

const LANGS = [
  { code: 'en', labelKey: 'language.en', locale: 'en_US' },
  { code: 'pt', labelKey: 'language.pt', locale: 'pt_BR' },
  { code: 'es', labelKey: 'language.es', locale: 'es_ES' },
];

export default function LanguageSwitcher({ compact = false }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const current = i18n.language?.split('-')[0] || 'en';

  const change = async (code) => {
    await i18n.changeLanguage(code);
    // persist to API if logged in
    if (isAuthenticated) {
      try {
        const target = LANGS.find(l => l.code === code)?.locale || 'en_US';
        await apiFetch('/api/v1/me/preferences', { method: 'PUT', body: { locale: target } });
      } catch (_) { /* ignore */ }
    }
  };

  if (compact) {
    return (
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        aria-label={t('language.label')}
        className="px-2 py-1 text-sm border border-gray-300 rounded-md w-full"
      >
        {LANGS.map(l => (
          <option key={l.code} value={l.code}>{t(l.labelKey)}</option>
        ))}
      </select>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{t('language.label')}:</span>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => change(l.code)}
          className={`px-2 py-1 text-sm rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${current === l.code ? 'bg-accent text-white border-accent' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          {t(l.labelKey)}
        </button>
      ))}
    </div>
  );
}
