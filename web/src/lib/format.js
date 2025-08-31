export function formatCurrency(cents, currency = 'USD', localeCode) {
  const n = (cents ?? 0) / 100;
  const locale = localeCode || getNavigatorLocale();
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatDate(d, localeCode) {
  const locale = localeCode || getNavigatorLocale();
  try {
    const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(dt);
  } catch {
    return String(d);
  }
}

export function getNavigatorLocale() {
  try {
    // align with i18next localStorage key
    const stored = localStorage.getItem('i18nextLng');
    if (stored) return stored;
  } catch {}
  return (navigator?.language || 'en-US');
}

