import { API } from "./auth";

// Normaliziraj path: obavezni leading "/", ukloni legacy "/_m", svedi duple "//"
function cleanPath(p) {
  if (!p) return "/";
  p = String(p).trim();
  if (!p.startsWith("/")) p = "/" + p;
  // makni eventualni stari prefiks "/_m"
  p = p.replace(/^\/_m(?=\/|$)/, "");
  // kolabiraj višestruke kosice u jednu
  p = p.replace(/\/{2,}/g, "/");
  return p;
}

export default async function api(path, { token, method = "GET", headers = {}, body } = {}) {
  const url = `${API}${cleanPath(path)}`;
  const opts = { method, headers: { ...headers } };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  if (!res.ok) {
    const msg = typeof data === "string" ? data : data?.message || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}
