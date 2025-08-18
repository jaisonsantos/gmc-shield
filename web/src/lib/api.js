// web/src/lib/api.js

const API_BASE = (import.meta.env.VITE_API || import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/+$/, "");
export const api = (p, opts = {}) => fetch(`${API_BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });

const TOKEN_KEY = "gmcshield_token";

export function getToken()       { return localStorage.getItem(TOKEN_KEY) || ""; }
export function setToken(t)     { if (t) localStorage.setItem(TOKEN_KEY, t); }
export function clearToken()    { localStorage.removeItem(TOKEN_KEY); }

function maybeAddNgrokBypass(headers) {
  try {
    const u = new URL(API_BASE);
    if (u.hostname.endsWith("ngrok-free.app")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }
  } catch {}
  return headers;
}

export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE}${path}`;
  const h = maybeAddNgrokBypass({
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...headers,
  });

  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { method, headers: h, ...(body ? { body: JSON.stringify(body) } : {}) });

  // garanta que recebemos JSON; se vier HTML do ngrok, falhe com mensagem clara
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON from ${url}, got ${ct || "unknown"}: ${text.slice(0, 120)}…`);
  }

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const msg = j.detail || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return res.status === 204 ? null : res.json();
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
  scan: (storeId, limit = 5) => apiFetch(`/api/stores/${storeId}/scan`, { method: "POST", body: { limit_items: limit } }),
};

// violations
export const Violations = {
  list: (storeId, runId) => apiFetch(`/api/stores/${storeId}/violations${runId ? `?run_id=${runId}` : ""}`),
};

// runs
export const Runs = {
  list: (storeId, limit = 20) => apiFetch(`/api/stores/${storeId}/scan/runs?limit=${limit}`),
};

// blocks
export const Blocks = {
  list: (storeId) => apiFetch(`/api/stores/${storeId}/blocks`),
  create: (storeId, feedItemId, reason = "") =>
    apiFetch(`/api/stores/${storeId}/blocks`, { method: "POST", body: { feed_item_id: feedItemId, reason } }),
  removeByFeedItem: (storeId, feedItemId) =>
    apiFetch(`/api/stores/${storeId}/blocks/by-feed-item/${encodeURIComponent(feedItemId)}`, { method: "DELETE" }),
};

// wordpress
export const WP = {
  saveCreds: (id, body) => apiFetch(`/api/stores/${id}/wp/credentials`, { method: 'POST', body }),
  status: (id) => apiFetch(`/api/stores/${id}/wp/status`),
  renderPolicy: (id, body) => apiFetch(`/api/stores/${id}/wp/policies/render`, { method: 'POST', body }),
  publishPolicy: (id, body) => apiFetch(`/api/stores/${id}/wp/policies/publish`, { method: 'POST', body }),
  syncBlocks: (id, mode='pull') => apiFetch(`/api/stores/${id}/wp/blocks/sync?mode=${mode}`, { method: 'POST' }),
};

// ops
export const Ops = {
  workerHealth: () => apiFetch("/api/ops/worker/health"),
};
