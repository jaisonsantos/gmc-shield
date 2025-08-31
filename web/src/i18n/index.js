import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/common.json';
import pt from './locales/pt/common.json';
import es from './locales/es/common.json';

const resources = {
  en: { common: en },
  pt: { common: pt },
  es: { common: es },
};

const supportedLngs = ['en', 'pt', 'es'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs,
    defaultNS: 'common',
    ns: ['common'],
    detection: {
      // order: localStorage -> navigator -> querystring
      order: ['localStorage', 'navigator', 'querystring'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      lookupQuerystring: 'lang',
    },
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

// Keep HTML lang in sync
i18n.on('languageChanged', (lng) => {
  try {
    const lang = (lng || 'en').split('-')[0];
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  } catch {}
});

export default i18n;

