// === ORIGINALNI AUTH (web app radi na ovome) ===

// ⬇⬇⬇ postavi bazni API bez trailing slasha i bez ikakvih dodatnih segmenata
export const API =
  (process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')) ||
  'https://api.try-buy-inv.net';

// Čuvamo token pod jednim ključem
export const TOKEN_KEY = "jwt";

// Trenutni user iz tokena
export function getCurrentUser() {
  const t = getToken();
  if (!t) return null;
  return parseJwt(t);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ---- countries helper (KAKO JE BILO — javna ruta /countries)
let _countriesCache = null;
export async function countryCodeById(countryId, token) {
  if (!countryId) return null;
  if (!_countriesCache) {
    const auth = token || getToken() || "";
    const endpoint = `${API}/countries`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${auth}` }
    });
    _countriesCache = res.ok ? await res.json() : [];
  }
  const item = _countriesCache.find(c => String(c.id) === String(countryId));
  return item?.code || null;
}
