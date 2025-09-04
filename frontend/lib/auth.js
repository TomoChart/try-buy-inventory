
// Bazni API iz env-a, bez završne "/" i bez legacy "/_m"
const RAW_API = (process.env.NEXT_PUBLIC_API_URL || 'https://api.try-buy-inv.net').trim();

export const API = RAW_API
  .replace(/\/+$/, '')          // makni trailing slash(eve)
  .replace(/\/_m(?=\/|$)/, ''); // makni "/_m" ako je ostalo u vrijednosti

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
