// web/src/lib/api.js

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const TOKEN_KEY = "gmcshield_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
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

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = j.detail || JSON.stringify(j);
    } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  // 204 no-content
  if (res.status === 204) return null;
  return res.json();
}

// auth
export const Auth = {
  login: (email, password) => apiFetch("/api/auth/login", { method: "POST", body: { email, password } }),
  whoami: () => apiFetch("/api/auth/whoami"),
};

// stores
export const Stores = {
  list: () => apiFetch("/api/stores"),
  createDemo: () =>
    apiFetch("/api/stores", {
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
  scan: (storeId) =>
    apiFetch(`/api/stores/${storeId}/scan`, {
      method: "POST",
      // retorna {queued, skipped,...}
    }),
};

// violations
export const Violations = {
  list: (storeId) => apiFetch(`/api/stores/${storeId}/violations`),
};

// blocks
export const Blocks = {
  list: (storeId) => apiFetch(`/api/stores/${storeId}/blocks`),
  create: (storeId, feedItemId, reason = "") =>
    apiFetch(`/api/stores/${storeId}/blocks`, {
      method: "POST",
      body: { feed_item_id: feedItemId, reason },
    }),
  removeByFeedItem: (storeId, feedItemId) =>
    apiFetch(`/api/stores/${storeId}/blocks/by-feed-item/${encodeURIComponent(feedItemId)}`, {
      method: "DELETE",
    }),
};

// ops
export const Ops = {
  workerHealth: () => apiFetch("/api/ops/worker/health"),
};

