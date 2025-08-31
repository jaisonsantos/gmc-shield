// web/src/lib/api.js

// 1. A constante API_BASE deve ser um caminho relativo para que o proxy do Vite funcione.
const API_BASE = "";

let TOKEN_MEM = "";

function readPersisted() {
  try { return localStorage.getItem("gmc_token") || ""; } catch { return ""; }
}
function writePersisted(t) {
  try { if (t) localStorage.setItem("gmc_token", t); else localStorage.removeItem("gmc_token"); } catch {}
}

export function getToken() {
  if (TOKEN_MEM) return TOKEN_MEM;
  TOKEN_MEM = readPersisted();
  return TOKEN_MEM;
}
export function setToken(t) { TOKEN_MEM = t || ""; writePersisted(TOKEN_MEM); }
export function clearToken() { TOKEN_MEM = ""; writePersisted(""); }

export async function apiFetch(path, { method = "GET", body, headers = {}, json = true } = {}) {
  // 2. O URL agora será relativo, ex: "/api/auth/login"
  const url = `${API_BASE}${path}`;
  const h = {
    ...(json && body ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  // Attach Accept-Language based on selected locale (i18next)
  try {
    const l = localStorage.getItem('i18nextLng');
    if (l) h['Accept-Language'] = l;
  } catch {}

  const res = await fetch(url, {
    method,
    headers: h,
    ...(body ? { body: json ? JSON.stringify(body) : body } : {}),
  });

  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    // graceful 401 handling: clean session and redirect to login
    if (res.status === 401) {
      try { clearToken(); } catch {}
      const next = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
      const loginUrl = `/login${next ? `?next=${next}&reason=session_expired` : ''}`;
      if (typeof window !== 'undefined') {
        // Avoid redirect loops by only redirecting from app pages
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = loginUrl;
        }
      }
      const err = new Error("auth.sessionExpired");
      err.status = 401;
      throw err;
    }
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => ({}));
      const msg = j.detail || `${res.status} ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    const text = await res.text();
    const err = new Error(`Erro ${res.status}: ${text.slice(0, 150)}…`);
    err.status = res.status;
    throw err;
  }
  
  // Apenas tenta fazer parse de JSON se o content-type for o correto
  if (ct.includes("application/json")) {
    return res.status === 204 ? null : res.json();
  }
  
  return null; // Retorna nulo para respostas não-JSON (como redirects)
}

// auth
export const Auth = {
  login: (email, password) => apiFetch("/api/auth/login", { method: "POST", body: { email, password } }),
  whoami: () => apiFetch("/api/auth/whoami"),
};

export const Me = {
  getPreferences: () => apiFetch('/api/v1/me/preferences'),
  savePreferences: (prefs) => apiFetch('/api/v1/me/preferences', { method: 'PUT', body: prefs }),
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
  dashboard: (storeId) => apiFetch(`/api/stores/${storeId}/dashboard`),
};

export const Feeds = {
  configure: (storeId, body) => apiFetch(`/api/stores/${storeId}/feed`, { method: "POST", body }),
  versions: (storeId) => apiFetch(`/api/stores/${storeId}/feed/versions`),
  ingestFromUrl: (storeId) => apiFetch(`/api/stores/${storeId}/feed/ingest`, { method: "POST" }),
  upload: (storeId, file, format) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", format);
    return apiFetch(`/api/stores/${storeId}/feed/upload`, { method: "POST", body: fd, json: false });
  },
};

export const ItemsApi = {
  list: (storeId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/stores/${storeId}/items${q ? `?${q}` : ""}`);
  },
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
