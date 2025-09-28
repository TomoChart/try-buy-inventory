import { useEffect, useState, useRef, useCallback } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken, handleUnauthorized } from "../../../lib/auth";
import CsvImportModal from "../../../components/CsvImportModal";
import { useRouter } from "next/router";
import HomeButton from '../../../components/HomeButton';
import * as XLSX from "xlsx";
import Papa from "papaparse";


function GalaxyTryHRPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  const [selected, setSelected] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [sort, setSort] = useState({ key: "", dir: "asc" });
  const [openMenu, setOpenMenu] = useState(null);

  const asString = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

  // koji red editiramo
  const [editingId, setEditingId] = useState(null);
  // lokalna polja za edit
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fPickupCity, setFPickupCity] = useState("");
  const [fModel, setFModel] = useState("");
    const [fSerial, setFSerial] = useState("");
    const [fContacted, setFContacted] = useState(false);
    const [fHandover, setFHandover] = useState("");   // YYYY-MM-DD

  const fileRef = useRef(null);

  // pomoćne
  function toDateOnly(v) {
    if (!v) return "";
    try { return new Date(v).toISOString().slice(0,10); } catch { return ""; }
  }

  function startEdit(r) {
    setEditingId(r.submission_id);
    setFEmail(r["Email"] || "");
    setFPhone(r["Phone"] || "");
    setFPickupCity(r["Pickup City"] || "");
    setFModel(r["Model"] || "");
      setFSerial(r["Serial"] || "");
      setFContacted(!!(r["Contacted"] || r.contacted));
      setFHandover(r["Handover At"] ? toDateOnly(r["Handover At"]) : "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    const body = {
      email: fEmail || null,
      phone: fPhone || null,
      pickup_city: fPickupCity || null,
        contacted: fContacted ? new Date().toISOString() : null,
      handover_at: fHandover ? new Date(fHandover).toISOString() : null,
      model: fModel || null,
      serial: fSerial || null,
    };
    const r = await fetch(`${API}/admin/galaxy-try/hr/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      alert(data?.error || "Save failed");
      return;
    }
    // reload liste
    await load();
    setEditingId(null);
  }

  function normalizeRow(r = {}) {
    const contacted = r.contacted ?? r["Contacted"] ?? r["Contacted At"];
    const finishedRaw = r.finished ?? r["Finished"];
    const daysLeftRaw = r.days_left ?? r["Days Left"];
    const daysLeftNum = Number(daysLeftRaw);
    const toBool = (val) => {
      if (typeof val === "string") {
        const normalized = val.trim().toLowerCase();
        if (!normalized) return false;
        if (["yes","da","true","1"].includes(normalized)) return true;
        if (["no","ne","false","0"].includes(normalized)) return false;
        return true;
      }
      return Boolean(val);
    };
    return {
      submission_id: asString(r.submission_id ?? r["Submission ID"] ?? ""),
      country_code:  asString(r.country_code  ?? r["Country Code"]  ?? ""),
      first_name:    asString(r.first_name    ?? r["First Name"]    ?? ""),
      last_name:     asString(r.last_name     ?? r["Last Name"]     ?? ""),
      email:         asString(r.email         ?? r["Email"]         ?? ""),
      phone:         asString(r.phone         ?? r["Phone"]         ?? ""),
      address:       asString(r.address       ?? r["Address"]       ?? ""),
      city:          asString(r.city          ?? r["City"]          ?? ""),
      pickup_city:   asString(r.pickup_city   ?? r["Pickup City"]   ?? ""),
      created_at:    asString(r.created_at    ?? r["Created At"]    ?? ""),
      contacted:     toBool(contacted),
      handover_at:   asString(r.handover_at   ?? r["Handover At"]   ?? ""),
      days_left:     Number.isFinite(daysLeftNum) ? daysLeftNum : null,
      model:         asString(r.model         ?? r["Model"]         ?? ""),
      serial:        asString(r.serial        ?? r["Serial"]        ?? ""),
      note:          asString(r.note          ?? r["Note"]          ?? ""),
      finished:      toBool(finishedRaw),
      user_feedback: asString(r.user_feedback ?? r["User Feedback"] ?? ""),
    };
  }
  async function handleDelete(submissionId) {
    try {
      if (!submissionId) { alert('Nedostaje Submission ID.'); return; }
      if (!confirm(`Obrisati zapis ${submissionId}?`)) return;

      const res = await fetch(`${API}/admin/galaxy-try/hr/${encodeURIComponent(submissionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.status === 204) {
        setRows(prev => prev.filter(r => r.submission_id !== submissionId));
        return;
      }
      const txt = await res.text();
      alert(`Delete nije uspio (${res.status}).\n${txt}`);
    } catch (err) {
      console.error('handleDelete error', err);
      alert('Greška pri brisanju.');
    }
  }

  async function handleContactedChange(id, checked) {
    try {
      const res = await fetch(`${API}/admin/galaxy-try/hr/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ contacted: checked ? new Date().toISOString() : null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Update failed");
        return;
      }
      setRows(prev =>
        prev.map(r =>
          r.submission_id === id
            ? { ...r, contacted: checked }
            : r
        )
      );
    } catch (err) {
      console.error('handleContactedChange error', err);
      alert('Greška pri spremanju kontakta.');
    }
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API}/admin/galaxy-try/hr/list`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (r.status === 401) { handleUnauthorized(router); return; }
      if (!r.ok) throw new Error();
      const data = await r.json();
      setRows((data || []).map(normalizeRow));
    } catch {
      setErr("Can't fetch applications.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

    const filtered = rows.filter(r => {
      for (const [k, v] of Object.entries(columnFilters)) {
        if (!v) continue;
        const val =
          k === "days_left" ? String(rowDaysLeft(r) ?? "") :
          k === "contacted" ? (r.contacted ? "Yes" : "No") :
          k === "finished" ? (r.finished ? "Yes" : "No") :
          String(r[k] ?? "");
        if (!val.toLowerCase().includes(String(v).toLowerCase())) return false;
      }
      return true;
    });

    const sorted = sort.key
      ? [...filtered].sort((a, b) => {
          let va, vb;
          if (sort.key === "days_left") {
            va = rowDaysLeft(a);
            vb = rowDaysLeft(b);
          } else if (sort.key === "contacted") {
            va = a.contacted ? 1 : 0;
            vb = b.contacted ? 1 : 0;
          } else if (sort.key === "finished") {
            va = a.finished ? 1 : 0;
            vb = b.finished ? 1 : 0;
          } else {
            va = a[sort.key];
            vb = b[sort.key];
          }
          const numA = Number(va);
          const numB = Number(vb);
          if (!isNaN(numA) && !isNaN(numB)) {
            return sort.dir === "asc" ? numA - numB : numB - numA;
          }
          va = (va ?? "").toString().toLowerCase();
          vb = (vb ?? "").toString().toLowerCase();
          if (va < vb) return sort.dir === "asc" ? -1 : 1;
          if (va > vb) return sort.dir === "asc" ? 1 : -1;
          return 0;
        })
      : filtered;

  const allSelected = sorted.length > 0 && sorted.every(r => selected.includes(r.submission_id));

  function toggleSelect(id) {
    setSelected(s => (s.includes(id) ? s.filter(k => k !== id) : [...s, id]));
  }

  function toggleSelectAll() {
    if (allSelected) {
      const visible = sorted.map(r => r.submission_id);
      setSelected(s => s.filter(k => !visible.includes(k)));
    } else {
      setSelected(sorted.map(r => r.submission_id));
    }
  }

  async function handleDeleteSelected() {
    if (!selected.length) return;
    if (!confirm(`Obrisati ${selected.length} zapisa?`)) return;
    for (const id of selected) {
      await fetch(`${API}/admin/galaxy-try/hr/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    }
    setRows(prev => prev.filter(r => !selected.includes(r.submission_id)));
    setSelected([]);
  }

  const columns = [
    { key: "submission_id", label: "Submission ID" },
    { key: "country_code", label: "Country Code" },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "pickup_city", label: "Pickup City" },
    { key: "created_at", label: "Created At" },
    { key: "contacted", label: "Contacted Yes/No" },
    { key: "handover_at", label: "Handover At" },
    { key: "days_left", label: "Days Left" },
    { key: "model", label: "Model" },
    { key: "serial", label: "Serial" },
    { key: "note", label: "Note" },
    { key: "finished", label: "Finished Yes/No" },
    { key: "user_feedback", label: "User Feedback" },
  ];

  return (
    <div
      className="p-6 min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/Background galaxytry.jpg')" }}
    >
      {/* Dodano: HomeButton prije glavnog sadržaja/hnaslova */}
      <HomeButton />

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="px-3 py-2 border rounded hover:bg-gray-50">
          ← Back
        </button>

        <h1 className="text-xl font-bold">Galaxy Try — HR</h1>

        {/* Gumb koji otvara hidden file input */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={async (e) => {
              await handleImportGalaxyCsv(e); // postojeći handler u istom fileu
              await load();                   // refresha listu nakon importa
            }}
          />
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded"
            onClick={() => fileRef.current?.click()}
          >
            Import CSV
          </button>
        </div>
      </div>

      {loading ? <div>Učitavam…</div> : err ? <div className="text-red-600">{err}</div> : (
        <>
          {selected.length > 0 && (
            <div className="mb-2">
              <button
                className="px-3 py-1 rounded bg-red-600 text-white"
                onClick={handleDeleteSelected}
              >
                Delete selected ({selected.length})
              </button>
            </div>
          )}
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                  {columns.map(c => (
                    <th key={c.key} className="relative p-2 text-left">
                      <div className="flex items-center">
                        {c.label}
                        {sort.key === c.key && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
                        <button
                          className="ml-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === c.key ? null : c.key);
                          }}
                        >
                          ▾
                        </button>
                      </div>
                      {openMenu === c.key && (
                        <div className="absolute z-10 mt-1 bg-white border rounded shadow-md p-2 w-40">
                          <button
                            className="block w-full text-left px-2 py-1 hover:bg-gray-100"
                            onClick={() => {
                              setSort({ key: c.key, dir: 'asc' });
                              setOpenMenu(null);
                            }}
                          >
                            Sort A to Z
                          </button>
                          <button
                            className="block w-full text-left px-2 py-1 hover:bg-gray-100"
                            onClick={() => {
                              setSort({ key: c.key, dir: 'desc' });
                              setOpenMenu(null);
                            }}
                          >
                            Sort Z to A
                          </button>
                          <div className="mt-2">
                            <input
                              className="border rounded w-full px-1 py-0.5"
                              placeholder="Text filter"
                              value={columnFilters[c.key] || ''}
                              onChange={e => setColumnFilters(cf => ({ ...cf, [c.key]: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const left = rowDaysLeft(r);
                  const leftStyle = left === 0 ? { backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: 600 } : {};
                  return (
                    <tr key={r.submission_id}>
                      <td className="p-2"><input type="checkbox" checked={selected.includes(r.submission_id)} onChange={() => toggleSelect(r.submission_id)} /></td>
                      {columns.map(col => {
                        const { key } = col;
                        if (key === "contacted") {
                          return (
                            <td key={key} className="text-center">
                              <input
                                type="checkbox"
                                checked={r.contacted}
                                onChange={e => handleContactedChange(r.submission_id, e.target.checked)}
                              />
                            </td>
                          );
                        }
                        if (key === "created_at" || key === "handover_at") {
                          return <td key={key}>{fmtDateDMY(r[key])}</td>;
                        }
                        if (key === "days_left") {
                          return <td key={key} style={leftStyle}>{left === "" || left === null ? "" : left}</td>;
                        }
                        if (key === "finished") {
                          return <td key={key} className="text-center">{r.finished ? "Yes" : "No"}</td>;
                        }
                        const value = r[key];
                        return <td key={key}>{value !== undefined && value !== null && value !== "" ? value : "-"}</td>;
                      })}
                      <td className="p-2 whitespace-nowrap">
                        <button
                          className="px-2 py-1 rounded bg-blue-600 text-white mr-2"
                          onClick={() => { setEditing(r); setShowEdit(true); }}
                        >
                          Edit
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-red-600 text-white"
                          onClick={() => handleDelete(r.submission_id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showEdit && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-[720px] max-w-[95vw]">
            <h3 className="font-semibold text-lg mb-3">
              Edit — {editing.submission_id}
            </h3>
            <EditForm
              initial={editing}
              onCancel={() => { setShowEdit(false); setEditing(null); }}
              onSaved={async () => { setShowEdit(false); setEditing(null); await load(); }}
            />
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button
          className="px-3 py-1 rounded bg-green-600 text-white"
          onClick={() => setShowAdd(true)}
        >
          + Add
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-[720px] max-w-[95vw]">
            <h3 className="font-semibold text-lg mb-3">Add new — HR</h3>
            <AddForm
              onCancel={() => setShowAdd(false)}
              onSaved={async () => { setShowAdd(false); await load(); }}
            />
          </div>
        </div>
      )}

      {/*
      {showImport && (
        <CsvImportModal
          onClose={() => { setShowImport(false); load(); }}
          countryCode="HR"
          kind="leads"
        />
      )}
      */}
    </div>
  );
}

// dd-mm-yyyy prikaz
function fmtDateDMY(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return String(value); // ako već dolazi u dobrom formatu
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// 14-dnevni countdown od handover_at
function daysLeft(handover_at) {
  if (!handover_at) return "";
  const start = new Date(handover_at);
  if (isNaN(start)) return "";
  const today = new Date();
  // normaliziraj na 00:00
  start.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  const diffDays = Math.round((today - start) / (1000*60*60*24));
  return 14 - diffDays; // ako je danas = handover → 14
}

function rowDaysLeft(row) {
  if (!row) return "";
  if (row.days_left !== null && row.days_left !== undefined && row.days_left !== "") {
    return row.days_left;
  }
  return daysLeft(row.handover_at);
}

// --- CSV/XLSX import (auto) ---
const LEAD_FIELDS = [
  "submission_id","created_at","first_name","last_name","email","phone",
  "address","city","postal_code","pickup_city","contacted",
  "handover_at","days_left","model","serial","note","finished","user_feedback","form_name",
];

const ALIASES = {
  "e-mail": "email",
  "zip": "postal_code",
  "created at": "created_at",
  "handover at": "handover_at",
  "date handover": "handover_at", "date_handover": "handover_at",
  "date contacted": "contacted", "date_contacted": "contacted",
  "contacted at": "contacted",
  "contacted yes-no": "contacted",   // ← tvoje stvarno zaglavlje
  "days left": "days_left", "daysleft": "days_left",
 // serial varijante (Galaxy Try koristi serial, ne imei)
  "serial": "serial", "serial number": "serial", "serial_number": "serial",
  "s/n": "serial", "sn": "serial",
};

function guessMap(headers) {
  const map = {};
  headers.forEach(h => {
    const raw = String(h || "").trim();
    const key = raw.toLowerCase();
    const alias = ALIASES[key];
    if (alias && LEAD_FIELDS.includes(alias)) { map[raw] = alias; return; }
    if (LEAD_FIELDS.includes(key)) { map[raw] = key; return; }
    if (key === "s/n" || key === "s\\n" || key === "serial") map[raw] = "serial";
  });
  return map;
}

function excelDateToISO(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const o = XLSX.SSF.parse_date_code(v);
    if (!o) return null;
    const d = new Date(Date.UTC(o.y, o.m - 1, o.d, o.H || 0, o.M || 0, o.S || 0));
    return d.toISOString();
  }
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

// Fallback mapiranje zaglavlja -> očekivana polja (case-insensitive)
const HEADER_MAP = {
  // serial (nekad je bio IMEI, S/N, serial number…)
  "imei": "serial",
  "imei1": "serial",
  "s/n": "serial",
  "sn": "serial",
  "serial number": "serial",
  "serial_number": "serial",
  "serialno": "serial",

  // created_at
  "created at": "created_at",
  "creation date": "created_at",
  "date created": "created_at",

  // contacted / handover
  "contacted yes-no": "contacted",
  "contacted at": "contacted",
  "date contacted": "contacted",
  "date_contacted": "contacted",
  "handover at": "handover_at",
  "date handover": "handover_at",
  "date_handover": "handover_at",

  // days left
  "days left": "days_left",
  "daysleft": "days_left",

  // form name
  "form name (id)": "form_name",
  "form_name_(id)": "form_name",
};

function toLowerKey(k) { return String(k || "").trim().toLowerCase(); }
function mapHeaders(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const low = toLowerKey(k);
    o[HEADER_MAP[low] || low] = v;
  }
  return o;
}

function onlyDateISO(v) {
  if (v == null || v === "") return null;
  let s = String(v).trim();
  // odbaci vrijeme (ako postoji)
  if (s.includes(" ")) s = s.split(" ")[0];
  if (s.includes("T")) s = s.split("T")[0];
  // DD-MM-YYYY -> YYYY-MM-DD
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("-");
    s = `${yyyy}-${mm}-${dd}`;
  }
  // učvrsti na ponoć (UTC)
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d) ? null : d.toISOString();
}

function contactedToISO(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["yes","da","true","1"].includes(s)) return new Date().toISOString();
  if (["no","ne","false","0"].includes(s)) return null;
  // ako je već datum
  return onlyDateISO(v);
}

function toSerialString(v) {
  if (v == null) return "";
  return String(v).trim();
}

async function handleImportGalaxyCsv(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const name = (f.name || "").toLowerCase();
    let rows = [];

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    } else {
      const parsed = await new Promise((resolve, reject) => {
        Papa.parse(f, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
      });
      rows = Array.isArray(parsed.data) ? parsed.data : [];
    }

    if (!rows.length) { alert("Nema redaka u datoteci."); return; }

    // 1) mapiraj zaglavlja (fallback)
    const normalized = rows.map(mapHeaders);

    // 2) normaliziraj polja za Galaxy Try
    const out = normalized.map(r => {
      const o = {};
      if (r.submission_id) o.submission_id = String(r.submission_id).trim();
      if ("first_name" in r) o.first_name = r.first_name ?? null;
      if ("last_name"  in r) o.last_name  = r.last_name ?? null;
      if ("email"      in r) o.email      = r.email ?? null;
      if ("phone"      in r) o.phone      = r.phone ?? null;
      if ("address"    in r) o.address    = r.address ?? null;
      if ("city"       in r) o.city       = r.city ?? null;
      if ("postal_code"in r) o.postal_code= r.postal_code ?? null;
      if ("pickup_city"in r) o.pickup_city= r.pickup_city ?? null;
      if ("created_at" in r) o.created_at = onlyDateISO(r.created_at);   // date-only ISO
      if ("contacted"   in r) o.contacted   = contactedToISO(r.contacted);
      if ("handover_at" in r) o.handover_at = onlyDateISO(r.handover_at);
      if ("days_left" in r) {
        const n = Number(r.days_left);
        o.days_left = Number.isFinite(n) ? n : null;
      }
      if ("model" in r)  o.model = r.model ?? null;
      if ("serial" in r) o.serial = toSerialString(r.serial);            // Galaxy Try = serial
      if ("note" in r)   o.note  = r.note ?? null;
      if ("finished" in r) {
        const val = r.finished;
        if (typeof val === "boolean") {
          o.finished = val ? "Yes" : "";
        } else if (val == null || val === "") {
          o.finished = null;
        } else {
          const normalized = String(val).trim();
          if (["yes","da","true","1"].includes(normalized.toLowerCase())) o.finished = "Yes";
          else if (["no","ne","false","0"].includes(normalized.toLowerCase())) o.finished = "";
          else o.finished = normalized;
        }
      }
      if ("user_feedback" in r) o.user_feedback = r.user_feedback ?? null;
      if ("form_name" in r) o.form_name = r.form_name ?? null;
      return o;
    }).filter(x => x.submission_id);

    // === DEBUG/PREVIEW & VALIDACIJA ===
    console.log("[GT-HR IMPORT] Preview first 3 mapped rows:", out.slice(0,3));
    const missing = [];
    const hdr = Object.keys(out[0] || {});
    if (!hdr.includes("created_at")) missing.push("created_at");
    if (!hdr.includes("serial")) missing.push("serial");
    if (!hdr.includes("handover_at")) missing.push("handover_at");
    if (!hdr.includes("model")) missing.push("model");
    if (!hdr.includes("note")) missing.push("note");
    if (missing.length) {
      alert("Upozorenje: neka polja nisu prepoznata iz zaglavlja i neće se uvesti: " + missing.join(", "));
    }

    // 3) POST na HR import (upsert) – backend sada prima created_at + serial i vraća listu s created_at/serial
    const token = getToken();
    if (!token) { alert("Nema tokena. Prijavi se ponovno."); return; }

    const endpoint = `${API}/admin/galaxy-try/hr/import?mode=upsert`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows: out })
    });
    const dataRes = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dataRes?.error || "Import failed");

    alert(`Import gotov. Upsertano: ${dataRes?.upserted ?? "n/a"}`);
  } catch (err) {
    console.error(err);
    alert(`Greška pri importu: ${err.message}`);
  } finally {
    e.target.value = "";
  }
}

function EditForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    first_name:     initial.first_name || "",
    last_name:      initial.last_name  || "",
    email:          initial.email      || "",
    phone:          initial.phone      || "",
    address:        initial.address    || "",
    city:           initial.city       || "",
    pickup_city:    initial.pickup_city|| "",
    // 👇 new
    created_at:     toDateOnly(initial.created_at),
    contacted:      !!initial.contacted,
    handover_at:    initial.handover_at  || "",
    model:          initial.model          || "",
    serial:         initial.serial         || "",
    note:           initial.note           || "",
    days_left:      initial.days_left === null || initial.days_left === undefined ? "" : String(initial.days_left),
    finished:       !!initial.finished,
    user_feedback:  initial.user_feedback || "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);
      const parsedDays = Number(form.days_left);
      const normalizedDays = form.days_left === "" ? null : (Number.isFinite(parsedDays) ? parsedDays : null);
      const res = await fetch(`${API}/admin/galaxy-try/hr/${encodeURIComponent(initial.submission_id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          ...form,
          // 👇 normalize created_at to ISO date only
          created_at: onlyDateISO(form.created_at),
          contacted: form.contacted ? new Date().toISOString() : null,
          handover_at: form.handover_at ? new Date(form.handover_at).toISOString() : null,
          days_left: normalizedDays,
          finished: form.finished,
          user_feedback: form.user_feedback || null,
        })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      await onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  const Field = ({name,label,type="text",full=false}) => (
    <label className={`text-sm ${full ? "col-span-2" : ""}`}>
      <div className="mb-1">{label}</div>
      {type === "checkbox" ? (
        <input
          type="checkbox"
          className="border rounded px-2 py-1"
          checked={form[name] ?? false}
          onChange={e => setForm(s => ({...s, [name]: e.target.checked}))}
        />
      ) : type === "textarea" ? (
        <textarea
          className="border rounded px-2 py-1 w-full"
          rows={4}
          value={form[name] ?? ""}
          onChange={e => setForm(s => ({...s, [name]: e.target.value}))}
        />
      ) : (
        <input
          type={type}
          className="border rounded px-2 py-1 w-full"
          value={form[name] ?? ""}
          onChange={e => setForm(s => ({...s, [name]: e.target.value}))}
        />
      )}
    </label>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Field name="first_name" label="First Name" />
        <Field name="last_name"  label="Last Name" />
        <Field name="email"      label="Email" />
        <Field name="phone"      label="Phone" />
        <Field name="address"    label="Address" />
        <Field name="city"       label="City" />
        <Field name="pickup_city"    label="Pickup City" />
        <Field name="created_at"  label="Created At"  type="date" />
        <Field name="contacted" label="Contacted Yes/No" type="checkbox" />
        <Field name="handover_at"  label="Handover At"  type="date" />
        <Field name="days_left" label="Days Left" type="number" />
        <Field name="finished" label="Finished" type="checkbox" />
        <Field name="model"          label="Model" />
        <Field name="serial"  label="Serial" />
        <Field name="note"           label="Note" type="textarea" full />
        <Field name="user_feedback" label="User Feedback" type="textarea" full />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="px-3 py-1 border rounded" onClick={onCancel}>Cancel</button>
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

  function AddForm({ onCancel, onSaved }) {
    const [form, setForm] = useState({
      first_name: "", last_name: "", email: "", phone: "",
      address: "", city: "", pickup_city: "",
      contacted: false, handover_at: "",
      model: "", serial: "", note: "",
      created_at: "",
      days_left: "",
      finished: false,
      user_feedback: "",
    });
    const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);
      const parsedDays = Number(form.days_left);
      const normalizedDays = form.days_left === "" ? null : (Number.isFinite(parsedDays) ? parsedDays : null);
      const createdAtIso = onlyDateISO(form.created_at);
      const handoverIso = form.handover_at ? new Date(form.handover_at).toISOString() : null;
      const res = await fetch(`${API}/admin/galaxy-try/hr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          ...form,
          contacted: form.contacted ? new Date().toISOString() : null,
          created_at: createdAtIso,
          handover_at: handoverIso,
          days_left: normalizedDays,
          finished: form.finished,
          user_feedback: form.user_feedback || null,
        })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || "Create failed");
      await onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  const Field = ({name,label,type="text",full=false}) => (
    <label className={`text-sm ${full ? "col-span-2" : ""}`}>
      <div className="mb-1">{label}</div>
      {type === "checkbox" ? (
        <input
          type="checkbox"
          className="border rounded px-2 py-1"
          checked={form[name] ?? false}
          onChange={e => setForm(s => ({...s, [name]: e.target.checked}))}
        />
      ) : type === "textarea" ? (
        <textarea
          className="border rounded px-2 py-1 w-full"
          rows={4}
          value={form[name] ?? ""}
          onChange={e => setForm(s => ({...s, [name]: e.target.value}))}
        />
      ) : (
        <input
          type={type}
          className="border rounded px-2 py-1 w-full"
          value={form[name] ?? ""}
          onChange={e => setForm(s => ({...s, [name]: e.target.value}))}
        />
      )}
    </label>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Field name="first_name" label="First Name" />
        <Field name="last_name"  label="Last Name" />
        <Field name="email"      label="Email" />
        <Field name="phone"      label="Phone" />
        <Field name="address"    label="Address" />
        <Field name="city"       label="City" />
        <Field name="pickup_city"    label="Pickup City" />
        <Field name="created_at"  label="Created At"  type="date" />
        <Field name="contacted" label="Contacted Yes/No" type="checkbox" />
        <Field name="handover_at"  label="Handover At"  type="date" />
        <Field name="days_left" label="Days Left" type="number" />
        <Field name="finished" label="Finished" type="checkbox" />
        <Field name="model"          label="Model" />
        <Field name="serial"  label="Serial" />
        <Field name="note"           label="Note" type="textarea" full />
        <Field name="user_feedback" label="User Feedback" type="textarea" full />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="px-3 py-1 border rounded" onClick={onCancel}>Cancel</button>
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default withAuth(GalaxyTryHRPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });