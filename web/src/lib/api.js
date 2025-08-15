// web/src/lib/api.js
const API_BASE =
  (import.meta.env.VITE_API ?? import.meta.env.VITE_API_BASE ?? "http://localhost:8000")
    .replace(/\/$/, ""); // sem barra final

console.log("[GMC] API_BASE =", API_BASE);

const TOKEN_KEY = "gmcshield_token";

export function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE}${path}`;
  const opts = {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const token = getToken();
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, opts);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    // Erro de API: mostre a primeira parte da resposta
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}: ${text.slice(0, 200)}`);
  }

  if (ct.includes("application/json")) {
    try { return JSON.parse(text); } catch (e) {
      throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
    }
  }

  // Veio HTML? Então você está chamando o host errado (WEB/Vercel) em vez da API
  throw new Error(`Expected JSON from ${url}, got ${ct || "unknown"}: ${text.slice(0, 200)}`);
}

// auth
export const Auth = {
  login: (email, password) => apiFetch("/api/auth/login", { method: "POST", body: { email, password } }),
  whoami: () => apiFetch("/api/auth/whoami"),
};

// stores
export const Stores = {
  list: () => apiFetch("/api/stores"),
  createDemo: () => apiFetch("/api/stores", {
    method: "POST",
    body: {
      name: "Loja UI",
      platform: "woocommerce",
      base_url: "http://localhost",
      country: "ES",
      currency: "EUR",
      contact_email: "admin@example.com",
    },
  }),
  scan: (storeId) => apiFetch(`/api/stores/${storeId}/scan`, { method: "POST" }),
};

// violations
export const Violations = {
  list: (storeId) => apiFetch(`/api/stores/${storeId}/violations`),
};

// blocks
export const Blocks = {
  list: (storeId) => apiFetch(`/api/stores/${storeId}/blocks`),
  create: (storeId, feedItemId, reason = "") =>
    apiFetch(`/api/stores/${storeId}/blocks`, { method: "POST", body: { feed_item_id: feedItemId, reason } }),
  removeByFeedItem: (storeId, feedItemId) =>
    apiFetch(`/api/stores/${storeId}/blocks/by-feed-item/${encodeURIComponent(feedItemId)}`, { method: "DELETE" }),
};

// ops
export const Ops = {
  workerHealth: () => apiFetch("/api/ops/worker/health"),
};
