// pages/devices/index.jsx
import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/AppLayout";
import { API, getCurrentUser, countryCodeById } from "../../lib/auth";

const PAGE_SIZE = 10;

export default function DevicesPage() {
  const user = getCurrentUser();

  const [code, setCode] = useState(null);       // HR/SI/RS
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // 1) Odredi country code:
  //    - country_admin: mapiraj iz JWT countryId -> code
  //    - superadmin (nema countryId): pokaži info poruku (odabir zemlje u top baru), pa ne povlači podatke dok code != null
  useEffect(() => {
    (async () => {
      if (!user) return; // AppLayout će te vratiti na /login
      if (user.countryId) {
        const c = await countryCodeById(user.countryId);
        setCode((c || "").toUpperCase());
      } else {
        // superadmin bez zemlje -> čeka da korisnik odabere zemlju u top switcheru (preporuka:
        // idi na /c/{code}/dashboard pa klikni Uređaji)
        setCode(null);
      }
    })();
  }, [user]);

  // 2) Učitaj listu uređaja kad su code/page/search spremni
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!code) { setLoading(false); return; }
      setLoading(true); setErr("");
      try {
        const qs = new URLSearchParams({
          code,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          ...(search ? { search } : {}),
        }).toString();

        const res = await fetch(`${API}/devices?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        if (mounted) setErr("Ne mogu učitati uređaje.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [code, page, search]);

  // 3) Pagination kalkulacije
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / PAGE_SIZE)),
    [total]
  );

  return (
    <AppLayout>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Uređaji{code ? ` — ${code}` : ""}</h1>
          <p className="text-slate-600 text-sm">
            Evidencija uređaja (mock dok ne dodamo pravi model/tablice).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Pretraži (IMEI/Model/Lokacija)…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>

      {/* Superadmin bez odabrane zemlje */}
      {!user?.countryId && !code && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-4 mb-4">
          Superadmin si – odaberi zemlju u gornjem <b>Country switcheru</b> (top bar) → potom otvori Uređaje za tu zemlju.
        </div>
      )}

      {err && <div className="text-red-600 mb-3">{err}</div>}

      {loading ? (
        <div className="text-slate-600">Učitavam…</div>
      ) : code ? (
        <>
          <DevicesTable rows={items} />

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Ukupno: <b>{total}</b> • Stranica {page}/{totalPages}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prethodna
              </button>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sljedeća →
              </button>
            </div>
          </div>
        </>
      ) : null}
    </AppLayout>
  );
}

function DevicesTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="text-left bg-slate-50">
          <tr>
            <Th>IMEI</Th>
            <Th>Model</Th>
            <Th>Status</Th>
            <Th>Lokacija</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {rows && rows.length ? rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <Td mono>{r.imei}</Td>
              <Td>{r.model}</Td>
              <Td>
                <span className={[
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                  r.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                ].join(" ")}>
                  <Dot className={r.status === "active" ? "bg-emerald-500" : "bg-slate-400"} />
                  {r.status}
                </span>
              </Td>
              <Td>{r.location}</Td>
              <Td mono>{formatDateTime(r.updatedAt)}</Td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-500">Nema zapisa.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-2 font-semibold text-slate-700">{children}</th>;
}
function Td({ children, mono }) {
  return <td className={`px-4 py-2 ${mono ? "font-mono" : ""}`}>{children}</td>;
}
function Dot({ className }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${className || ""}`} />;
}
function formatDateTime(v) {
  try {
    const d = new Date(v);
    return d.toLocaleString();
  } catch {
    return v ?? "";
  }
}
