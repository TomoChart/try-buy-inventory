import React, { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/router";
import withAuth from "../../components/withAuth";
import { API, getToken, parseJwt, countryCodeById } from "../../lib/auth";
import Papa from "papaparse";
import HomeButton from '../../components/HomeButton';

const ALL_COLUMNS = [
  { key: "Model", label: "Model", always: true },
  { key: "Purpose", label: "Purpose" },
  { key: "Ownership", label: "Ownership", always: true },
  { key: "S/N", label: "Serial Number" },
  { key: "IMEI", label: "IMEI", always: true },
  { key: "Color", label: "Color" },
  { key: "Status", label: "Status", always: true },
  { key: "Location", label: "Location", always: true },
];

function DevicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [code, setCode] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "", model: "", purpose: "", ownership: "", color: "", city: "" });

  // columns visibility
  const [visible, setVisible] = useState(() => {
    const start = {};
    for (const c of ALL_COLUMNS) start[c.key] = !!c.always;
    // traženi dodatci: Purpose, S/N, Color -> default uključeni
    start["Purpose"] = true;
    start["S/N"] = true;
    start["Color"] = true;
    return start;
  });

  // edit/add modals
  const [editing, setEditing] = useState(null);   // detail JSON
  const [adding, setAdding] = useState(false);    // bool

  // selection & filters
  const [selected, setSelected] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [sort, setSort] = useState({ key: "", dir: "asc" });
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = getToken();
        const u = parseJwt(token) || {};
        let c = String(router.query.country || "").toUpperCase();
        if (!c && u.countryId) c = (await countryCodeById(u.countryId, token)) || "";
        if (!c && String(u.role || "").toUpperCase() === "SUPERADMIN") { router.replace("/select-country"); return; }
        if (!c) throw new Error("Nije moguće odrediti državu.");
        setCode(c);
        const r = await fetch(`${API}/admin/devices/${c.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("Greška pri dohvaćanju.");
        const data = await r.json();
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setErr("Ne mogu dohvatiti uređaje.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [router, router.query.country]);

  async function toggleExpand(serial) {
    if (expanded === serial) { setExpanded(null); setDetail(null); return; }
    setExpanded(serial); setDetail(null);
    try {
      const token = getToken();
      const r = await fetch(`${API}/admin/devices/${code.toLowerCase()}/${encodeURIComponent(serial)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      setDetail(await r.json());
    } catch { setDetail({ error: "Ne mogu dohvatiti detalje." }); }
  }

  function applyFilters(data) {
    const Q = q.trim().toLowerCase();
    return data.filter(r => {
      if (f.status && String(r.Status || "").toUpperCase() !== String(f.status).toUpperCase()) return false;
      if (f.model && String(r.Model || "").toLowerCase() !== f.model.toLowerCase()) return false;
      if (f.purpose && String(r.Purpose || "").toLowerCase() !== f.purpose.toLowerCase()) return false;
      if (f.ownership && String(r.Ownership || "").toLowerCase() !== f.ownership.toLowerCase()) return false;
      if (f.color && String(r.Color || "").toLowerCase() !== f.color.toLowerCase()) return false;
      if (f.city && String(r.City || "").toLowerCase() !== f.city.toLowerCase()) return false;
      if (!Q) return true;
      const hay = [
        r.Model, r.Purpose, r.Ownership, r["S/N"], r.IMEI, r.Color, r.Status, r.Location, r.City, r.Name, r.LeadID
      ].map(x => String(x || "").toLowerCase()).join("|");
      return hay.includes(Q);
    });
  }

  function rowKey(r) {
    return r.serial_number || r["Serial Number"] || r["S/N"] || r.IMEI;
  }

  const baseFiltered = applyFilters(rows);
  const filtered = baseFiltered.filter(r => {
    for (const [k, v] of Object.entries(columnFilters)) {
      if (!v) continue;
      const val = String(r[k] ?? "").toLowerCase();
      if (!val.includes(String(v).toLowerCase())) return false;
    }
    return true;
  });

  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        const va = (a[sort.key] ?? "").toString().toLowerCase();
        const vb = (b[sort.key] ?? "").toString().toLowerCase();
        if (va < vb) return sort.dir === "asc" ? -1 : 1;
        if (va > vb) return sort.dir === "asc" ? 1 : -1;
        return 0;
      })
    : filtered;

  function ColumnToggles() {
    return (
      <div className="flex flex-wrap gap-3 mb-3">
        {ALL_COLUMNS.map(c => (
          <label key={c.key} className={`text-sm flex items-center gap-1 ${c.always ? 'opacity-70 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              disabled={!!c.always}
              checked={!!visible[c.key]}
              onChange={e => setVisible(v => ({ ...v, [c.key]: e.target.checked }))}
            />
            {c.label}
          </label>
        ))}
      </div>
    );
  }

  function FilterBar() {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    const mModels = uniq(rows.map(r => r.Model));
    const mPurpose= uniq(rows.map(r => r.Purpose));
    const mOwner  = uniq(rows.map(r => r.Ownership));
    const mColor  = uniq(rows.map(r => r.Color));
    const mCity   = uniq(rows.map(r => r.City));
    const statuses= uniq(rows.map(r => String(r.Status || '').toUpperCase()));
    return (
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="border rounded px-2 py-1" />
        <select value={f.status} onChange={e=>setF({...f, status:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Status</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={f.model} onChange={e=>setF({...f, model:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Model</option>{mModels.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <select value={f.purpose} onChange={e=>setF({...f, purpose:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Purpose</option>{mPurpose.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <select value={f.ownership} onChange={e=>setF({...f, ownership:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Ownership</option>{mOwner.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <select value={f.color} onChange={e=>setF({...f, color:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Color</option>{mColor.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <select value={f.city} onChange={e=>setF({...f, city:e.target.value})} className="border rounded px-2 py-1">
          <option value="">City</option>{mCity.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={()=>setF({status:"",model:"",purpose:"",ownership:"",color:"",city:""})} className="px-3 py-1 rounded border">
          Clear
        </button>
      </div>
    );
  }

  function BackBtn() {
    return <button onClick={() => router.back()} className="mb-3 px-3 py-1 rounded border">← Back</button>;
  }

  const allSelected = sorted.length > 0 && sorted.every(r => selected.includes(rowKey(r)));

  function toggleSelect(key) {
    setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);
  }

  function toggleSelectAll() {
    if (allSelected) {
      const visibleKeys = sorted.map(r => rowKey(r));
      setSelected(s => s.filter(k => !visibleKeys.includes(k)));
    } else {
      setSelected(sorted.map(r => rowKey(r)));
    }
  }

  async function deleteSelected() {
    if (!selected.length) return;
    if (!confirm(`Obrisati ${selected.length} stavki?`)) return;
    const token = getToken();
    for (const serial of selected) {
      await fetch(`${API}/admin/devices/${code.toLowerCase()}/${encodeURIComponent(serial)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    const ref = await fetch(`${API}/admin/devices/${code.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${token}` }});
    setRows(await ref.json());
    setSelected([]);
  }

  // ===== Edit modal =====
  function EditModal({ item, onClose }) {
    const [form, setForm] = useState(() => ({
      model: item.Model || "",
      purpose: item.Purpose || "",
      ownership: item.Ownership || "",
      imei: item.IMEI || "",
      control_no: item["Control No"] || "",
      color: item.Color || "",
      status: item.Status || "",
      name: item.Name || "",
      lead_id: item.LeadID || "",
      location: item.Location || "",
      city: item.City || "",
      comment: item.Comment || "",
    }));
    const [saving, setSaving] = useState(false);
    const serial = item["S/N"] || item.serial_number;

    async function save() {
      setSaving(true);
      try {
        const r = await fetch(`${API}/admin/devices/${code.toLowerCase()}/${encodeURIComponent(serial)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Save failed");

        // refresh glavne liste
        const ref = await fetch(`${API}/admin/devices/${code.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${getToken()}` }});
        setRows(await ref.json());
        onClose();
      } catch(e){ alert(e.message); } finally { setSaving(false); }
    }
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[680px] max-w-[95vw]">
          <h3 className="font-semibold text-lg mb-2">Edit device — {serial}</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["model","Model"],["purpose","Purpose"],["ownership","Ownership"],
              ["imei","IMEI"],["control_no","Control No"],["color","Color"],
              ["status","Status"],["name","Loan name"],["lead_id","LeadID"],
              ["location","Location"],["city","City"],["comment","Comment"]
            ].map(([k,label])=>(
              <label key={k} className="text-sm">
                <div className="mb-1">{label}</div>
                <input className="border rounded px-2 py-1 w-full"
                  value={form[k] ?? ""} onChange={e=>setForm(s=>({...s,[k]:e.target.value}))}/>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="px-3 py-1 border rounded" onClick={onClose}>Cancel</button>
            <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Add modal =====
  function AddModal({ onClose }) {
    const [form, setForm] = useState({ model:"", purpose:"", ownership:"", serial_number:"", imei:"", control_no:"", color:"", status:"AVAILABLE", location:"MPG Office", city:"", name:"", lead_id:"", comment:"" });
    const [saving, setSaving] = useState(false);
    async function save() {
      setSaving(true);
      try {
        const r = await fetch(`${API}/admin/devices/${code.toLowerCase()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Create failed");

        const ref = await fetch(`${API}/admin/devices/${code.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${getToken()}` }});
        setRows(await ref.json());
        onClose();
      } catch(e){ alert(e.message); } finally { setSaving(false); }
    }
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[680px] max-w-[95vw]">
          <h3 className="font-semibold text-lg mb-2">Add device — {code}</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["model","Model*"],["purpose","Purpose"],["ownership","Ownership"],["serial_number","Serial Number*"],
              ["imei","IMEI"],["control_no","Control No"],["color","Color"],
              ["status","Status"],["location","Location"],["city","City"],["name","Loan name"],["lead_id","LeadID"],["comment","Comment"]
            ].map(([k,label])=>(
              <label key={k} className="text-sm">
                <div className="mb-1">{label}</div>
                <input className="border rounded px-2 py-1 w-full"
                  value={form[k] ?? ""} onChange={e=>setForm(s=>({...s,[k]:e.target.value}))}/>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="px-3 py-1 border rounded" onClick={onClose}>Cancel</button>
            <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === CSV IMPORT HANDLER I UTIL FUNKCIJE ===
  async function handleCsvFile(file) {
    if (!file) return;
    const ok = confirm(`Uvesti CSV u ${code}?`);
    if (!ok) return;

    try {
      const rows = await parseCsvFile(file);
      if (!rows.length) { alert("CSV je prazan ili nečitljiv."); return; }

      // mapiraj CSV header -> payload polja koja koristimo na POST /admin/devices/:code
      const mapped = rows.map(mapCsvRowToPayload);

      // batch POST s malim kašnjenjem da ne zatrpamo backend
      let success = 0, fail = 0;
      for (const item of mapped) {
        const res = await fetch(`${API}/admin/devices/${String(code).toLowerCase()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(item),
        });
        if (res.ok) success++; else fail++;
        // kratka pauza
        await new Promise(r => setTimeout(r, 80));
      }

      // refresh liste
      const ref = await fetch(`${API}/admin/devices/${String(code).toLowerCase()}/list`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setRows(await ref.json());

      alert(`Import gotov. Uspješno: ${success}, neuspješno: ${fail}`);
    } catch (e) {
      console.error(e);
      alert("Greška pri importu: " + (e.message || "nepoznato"));
    }
  }

  function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(Array.isArray(res.data) ? res.data : []),
        error: (err) => reject(err),
      });
    });
  }

  function cleanImei(v) {
    if (v == null) return "";
    let s = String(v).trim();
    // makni trailing ".0" iz Excel-exporta
    if (/^\d+\.0$/.test(s)) s = s.replace(/\.0$/, "");
    // makni razmake / crtice
    s = s.replace(/[\s-]/g, "");
    return s;
  }

  // normaliziraj ključeve: trim + lowercase + zamijeni razmake s "_"
  function mapCsvRowToPayload(r) {
    // normaliziraj ključeve (makni razmake, lowercase)
    const norm = {};
    for (const k of Object.keys(r || {})) {
      const nk = String(k).trim().toLowerCase().replace(/\s+/g, "_");
      norm[nk] = r[k];
    }

    const get = (...alts) => {
      for (const a of alts) {
        const v = norm[a.toLowerCase()];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    };

    // Mapiranje na polja koja backend POST /admin/devices/:code prima
    // (dodatna CSV polja ignoriramo)
    return {
      model:          get("model"),
      purpose:        get("purpose"),
      ownership:      get("ownership"),
      serial_number:  get("serial_number","serial","s/n","serialnumber"),
      imei:           cleanImei(get("imei")),
      control_no:     get("control_no","control_number","controlno"),
      color:          get("color","colour"),
      status:         get("status"),
      location:       get("location"),
      city:           get("city"),
      name:           get("name","loan_name","leadname"),
      lead_id:        get("lead_id","leadid"),
      comment:        get("comment","note","napomena"),

      // Ako CSV ima ova polja, ZA SAD IH IGNORIRAMO u unosu (ne šaljemo):
      // country_code, submission_id, cityfromlead, date_assigned, expected_return,
      // date_last_change — možemo ih dodati kasnije po potrebi.
    };
  }

  if (loading) return <div className="p-6"><HomeButton /><div>Učitavam…</div></div>;
  if (err) return <div className="p-6"><HomeButton /><div className="text-red-600">{err}</div></div>;

  const headers = ALL_COLUMNS.filter(c => visible[c.key]);

  return (
    <div
      className="p-6 min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/Background S25 v1.jpg')" }}
    >
      <HomeButton />
      <BackBtn />
      <h1 className="text-xl font-bold mb-2">Devices — {code}</h1>

      <div className="mb-2 flex items-center gap-2">
        <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>setAdding(true)}>+ Add device</button>

        {/* CSV Import */}
        <label className="px-3 py-1 rounded border cursor-pointer">
          Import CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleCsvFile(e.target.files?.[0] || null)}
          />
        </label>
        <span className="text-xs opacity-60">Očekivani headeri: Model, Purpose, Ownership, Serial Number, IMEI, Control No, Color, Status, Location, City, Loan name, LeadID, Comment</span>
      </div>

      <ColumnToggles />
      <FilterBar />

      {selected.length > 0 && (
        <div className="mb-2">
          <button
            className="px-3 py-1 rounded bg-red-600 text-white"
            onClick={deleteSelected}
          >
            Delete selected ({selected.length})
          </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
              {headers.map(h => (
                <th key={h.key} className="relative text-left p-2">
                  <div className="flex items-center">
                    {h.label}
                    {sort.key === h.key && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
                    <button
                      className="ml-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(openMenu === h.key ? null : h.key);
                      }}
                    >
                      ▾
                    </button>
                  </div>
                  {openMenu === h.key && (
                    <div className="absolute z-10 mt-1 bg-white border rounded shadow-md p-2 w-40">
                      <button
                        className="block w-full text-left px-2 py-1 hover:bg-gray-100"
                        onClick={() => {
                          setSort({ key: h.key, dir: 'asc' });
                          setOpenMenu(null);
                        }}
                      >
                        Sort A to Z
                      </button>
                      <button
                        className="block w-full text-left px-2 py-1 hover:bg-gray-100"
                        onClick={() => {
                          setSort({ key: h.key, dir: 'desc' });
                          setOpenMenu(null);
                        }}
                      >
                        Sort Z to A
                      </button>
                      <div className="mt-2">
                        <input
                          className="border rounded w-full px-1 py-0.5"
                          placeholder="Text filter"
                          value={columnFilters[h.key] || ''}
                          onChange={e => setColumnFilters(cf => ({ ...cf, [h.key]: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </th>
              ))}
              <th className="text-left p-2">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const key = rowKey(r);
              return (
                <Fragment key={key}>
                  <tr
                    key={key}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="p-2"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggleSelect(key)} /></td>
                    <td className="p-2">{r.Model ?? "-"}</td>
                    <td className="p-2">{r.Purpose ?? "-"}</td>
                    <td className="p-2">{r.Ownership ?? "-"}</td>
                    <td className="p-2">{r.serial_number ?? r["Serial Number"] ?? r["S/N"] ?? "-"}</td>
                    <td className="p-2">{(r.IMEI ?? "").toString().replace(/\.0$/, "") || "-"}</td>
                    <td className="p-2">{r.Color ?? "-"}</td>
                    <td className="p-2">{r.Status ?? "-"}</td>
                    <td className="p-2">{r.Location ?? "-"}</td>
                    <td className="p-2 flex gap-2">
                      <button className="px-2 py-1 rounded bg-blue-600 text-white" onClick={() => toggleExpand(key)}>
                        {expanded === key ? "Sakrij" : "Detalji"}
                      </button>
                      <button className="px-2 py-1 rounded bg-amber-600 text-white" onClick={() => setEditing(r)}>Edit</button>
                    </td>
                  </tr>
                  {expanded === key && (
                    <tr className="bg-gray-50">
                      <td colSpan={headers.length + 2} className="p-3">
                        {!detail && <div>Učitavam detalje…</div>}
                        {detail && detail.error && <div className="text-red-600">{detail.error}</div>}
                        {detail && !detail.error && (
                          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(detail, null, 2)}</pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <EditModal item={editing} onClose={()=>setEditing(null)} />}
      {adding && <AddModal onClose={()=>setAdding(false)} />}
    </div>
  );
}

export default withAuth(DevicesPage, { roles: ["country_admin", "superadmin"] });
