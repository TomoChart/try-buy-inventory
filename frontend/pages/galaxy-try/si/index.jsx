import { useEffect, useState, useRef } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken, handleUnauthorized } from "../../../lib/auth";
import CsvImportModal from "../../../components/CsvImportModal";
import { useRouter } from "next/router";


function GalaxyTrySIPage() {
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

  // koji red editiramo
  const [editingId, setEditingId] = useState(null);
  // lokalna polja za edit
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fPickupCity, setFPickupCity] = useState("");
  const [fModel, setFModel] = useState("");
  const [fSerial, setFSerial] = useState("");
  const [fContacted, setFContacted] = useState(""); // YYYY-MM-DD
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
    setFSerial(r["Serial Number"] || "");
    setFContacted(r["Contacted At"] ? toDateOnly(r["Contacted At"]) : "");
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
      date_contacted: fContacted ? new Date(fContacted).toISOString() : null,
      date_handover: fHandover ? new Date(fHandover).toISOString() : null,
      model: fModel || null,
      serial_number: fSerial || null,
    };
    const r = await fetch(`${API}/admin/galaxy-try/si/${id}`, {
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
    return {
      submission_id: r.submission_id ?? r["Submission ID"] ?? "",
      first_name:     r.first_name     ?? r["First Name"]     ?? "",
      last_name:      r.last_name      ?? r["Last Name"]      ?? "",
      email:          r.email          ?? r["Email"]          ?? "",
      phone:          r.phone          ?? r["Phone"]          ?? "",
      address:        r.address        ?? r["Address"]        ?? "",
      city:           r.city           ?? r["City"]           ?? "",
      pickup_city:    r.pickup_city    ?? r["Pickup City"]    ?? "",
      created_at:     r.created_at     ?? r["Created At"]     ?? "",
      date_contacted: r.date_contacted ?? r["Contacted At"]   ?? "",
      date_handover:  r.date_handover  ?? r["Handover At"]    ?? "",
      model:          r.model          ?? r["Model"]          ?? "",
      serial_number:  r.serial_number  ?? r["Serial Number"]  ?? "",
      note:           r.note           ?? r["Note"]           ?? "",
    };
  }

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/admin/galaxy-try/si/list`, {
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
  }

  useEffect(() => { load(); }, []);

  function handleSort(key) {
    setSort(s => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const filtered = rows.filter(r => {
    for (const [k, v] of Object.entries(columnFilters)) {
      if (!v) continue;
      const val = k === "daysLeft" ? String(daysLeft(r.date_handover)) : String(r[k] ?? "");
      if (!val.toLowerCase().includes(String(v).toLowerCase())) return false;
    }
    return true;
  });

  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        let va, vb;
        if (sort.key === "daysLeft") {
          va = daysLeft(a.date_handover);
          vb = daysLeft(b.date_handover);
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
      await fetch(`${API}/admin/galaxy-try/si/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    }
    setRows(prev => prev.filter(r => !selected.includes(r.submission_id)));
    setSelected([]);
  }

  const columns = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "pickup_city", label: "Pickup City" },
    { key: "created_at", label: "Created At" },
    { key: "date_contacted", label: "Contacted At" },
    { key: "date_handover", label: "Handover At" },
    { key: "daysLeft", label: "Days left" },
    { key: "model", label: "Model" },
    { key: "serial_number", label: "Serial Number" },
    { key: "note", label: "Note" },
  ];

  return (
    <div
      className="p-6 min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/Background galaxytry.jpg')" }}
    >
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="px-3 py-2 border rounded hover:bg-gray-50">
          ← Back
        </button>

        <h1 className="text-xl font-bold">Galaxy Try — SI</h1>

        {/* Gumb koji otvara hidden file input */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
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
                    <th key={c.key} className="p-2 text-left">
                      <div
                        className="flex items-center cursor-pointer select-none"
                        onClick={() => handleSort(c.key)}
                      >
                        {c.label}
                        {sort.key === c.key && (sort.dir === "asc" ? " ▲" : " ▼")}
                      </div>
                      <input
                        className="mt-1 border rounded w-full px-1"
                        value={columnFilters[c.key] || ""}
                        onChange={e => setColumnFilters(cf => ({ ...cf, [c.key]: e.target.value }))}
                      />
                    </th>
                  ))}
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const left = daysLeft(r.date_handover);
                  const leftStyle = (left === 0) ? { backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: 600 } : {};
                  return (
                    <tr key={r.submission_id}>
                      <td className="p-2"><input type="checkbox" checked={selected.includes(r.submission_id)} onChange={() => toggleSelect(r.submission_id)} /></td>
                      <td>{r.first_name ?? "-"}</td>
                      <td>{r.last_name ?? "-"}</td>
                      <td>{r.email ?? "-"}</td>
                      <td>{r.phone ?? "-"}</td>
                      <td>{r.address || "-"}</td>
                      <td>{r.city || "-"}</td>
                      <td>{r.pickup_city ?? "-"}</td>
                      <td>{fmtDateDMY(r.created_at)}</td>
                      <td>{fmtDateDMY(r.date_contacted)}</td>
                      <td>{fmtDateDMY(r.date_handover)}</td>
                      <td style={leftStyle}>{left === "" ? "" : left}</td>
                      <td>{r.model ?? "-"}</td>
                      <td>{r.serial_number ?? "-"}</td>
                      <td>{r.note ?? "-"}</td>
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
            <h3 className="font-semibold text-lg mb-3">Add new — SI</h3>
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
          countryCode="SI"
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

// 14-dnevni countdown od date_handover
function daysLeft(date_handover) {
  if (!date_handover) return "";
  const start = new Date(date_handover);
  if (isNaN(start)) return "";
  const today = new Date();
  // normaliziraj na 00:00
  start.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  const diffDays = Math.round((today - start) / (1000*60*60*24));
  return 14 - diffDays; // ako je danas = handover → 14
}

function EditableRow({ row, onSave }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    "First Name": row["First Name"],
    "Last Name": row["Last Name"],
    "Email": row["Email"],
    "Phone": row["Phone"],
    "Pickup City": row["Pickup City"],
    "Created At": row["Created At"],
    "Contacted At": row["Contacted At"],
    "Handover At": row["Handover At"],
    "Model": row["Model"],
    "Serial Number": row["Serial Number"]
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSave() {
    setEdit(false);
    // Mapiraj polja na backend payload (npr. date_contacted, date_handover, note, ...)
    onSave({
      email: form["Email"],
      phone: form["Phone"],
      pickup_city: form["Pickup City"],
      date_contacted: form["Contacted At"],
      date_handover: form["Handover At"],
      model: form["Model"],
      serial_number: form["Serial Number"],
      note: row["Note"]
    });
  }

  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="p-2">{form["First Name"]}</td>
      <td className="p-2">{form["Last Name"]}</td>
      <td className="p-2">
        {edit ? (
          <input
            name="Email"
            value={form["Email"] || ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded w-32"
          />
        ) : form["Email"]}
      </td>
      <td className="p-2">
        {edit ? (
          <input
            name="Phone"
            value={form["Phone"] || ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded w-24"
          />
        ) : form["Phone"]}
      </td>
      <td className="p-2">
        {edit ? (
          <input
            name="Pickup City"
            value={form["Pickup City"] || ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded w-24"
          />
        ) : form["Pickup City"]}
      </td>
      <td className="p-2">
        {form["Created At"] ? new Date(form["Created At"]).toISOString().slice(0, 10) : ""}
      </td>
      <td className="p-2">
        {edit ? (
          <input
            type="date"
            name="Contacted At"
            value={form["Contacted At"] ? form["Contacted At"].slice(0, 10) : ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded"
          />
        ) : form["Contacted At"] ? form["Contacted At"].slice(0, 10) : ""}
      </td>
      <td className="p-2">
        {edit ? (
          <input
            type="date"
            name="Handover At"
            value={form["Handover At"] ? form["Handover At"].slice(0, 10) : ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded"
          />
        ) : form["Handover At"] ? form["Handover At"].slice(0, 10) : ""}
      </td>
      <td className="p-2">
        {edit ? (
          <input
            name="Model"
            value={form["Model"] || ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded w-24"
          />
        ) : form["Model"]}
      </td>
      <td className="p-2">
        {edit ? (
          <input
            name="Serial Number"
            value={form["Serial Number"] || ""}
            onChange={handleChange}
            className="border px-1 py-0.5 rounded w-24"
          />
        ) : form["Serial Number"]}
      </td>
      <td className="p-2">
        {edit ? (
          <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={handleSave}>
            Save
          </button>
        ) : (
          <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => setEdit(true)}>
            ✏️
          </button>
        )}
      </td>
    </tr>
  );
}

// === Galaxy Try CSV import (UPsert) ===
// zahtijeva: TOKEN iz getToken(), i `code` (HR/SI/RS) koji već koristiš na ekranu
async function handleImportGalaxyCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();

    // 1) parse CSV (simple) -> array of objects
    const rows = [];
    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (!lines.length) { alert('Prazan CSV.'); return; }
    const headers = lines[0].split(',').map(h => h.trim());

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? '').trim(); });
      rows.push(obj);
    }

    // 2) normalizacija ključeva (kanonski nazivi koje backend očekuje)
    const normRows = rows.map(r => {
      const g = (k) => {
        const keys = Object.keys(r);
        const hit = keys.find(x => String(x).toLowerCase() === k);
        return hit ? r[hit] : '';
      };
      const getAny = (...alts) => {
        for (const a of alts) {
          const v = g(a.toLowerCase());
          if (v !== undefined && v !== '') return v;
        }
        return '';
      };

      return {
        // ključno: submission_id je obavezno
        submission_id: getAny('submission_id'),

        created_at:     getAny('created_at'),
        first_name:     getAny('first_name'),
        last_name:      getAny('last_name'),
        email:          getAny('email','e_mail','e_pošta','e-mail'),
        phone:          getAny('phone','telefon','mobitel'),
        address:        getAny('address','adresa'),
        city:           getAny('city','grad'),
        postal_code:    getAny('postal_code','zip','poštanski_broj'),
        pickup_city:    getAny('pickup_city'),
        consent:        getAny('consent','privola'),
        date_contacted: getAny('date_contacted'),
        date_handover:  getAny('date_handover'),

        model:          getAny('model'),
        serial_number:  getAny('serial_number','s/n','s_n'),
        note:           getAny('note','napomena'),
        form_name:      getAny('form_name'),
      };
    }).filter(r => r.submission_id); // bez submission_id backend preskače

    if (!normRows.length) { alert('Nema valjanih redova (submission_id nedostaje).'); return; }

    // 3) pozovi backend (UPsert)
    const token = getToken();
    if (!token) { alert('Nema tokena. Prijavi se ponovno.'); return; }

    const endpoint = `${API}/admin/galaxy-try/SI/import?mode=upsert`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows: normRows })
    });

    const data = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error(data?.error || 'Import failed');

    alert(`Import gotov. Upsertano: ${data?.upserted ?? 'n/a'}`);
    // Ako treba, ovdje napravi refresh liste:
    // await reloadGalaxyList();
  } catch (err) {
    console.error(err);
    alert(`Greška pri importu: ${err.message}`);
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
    date_contacted: initial.date_contacted || "",
    date_handover:  initial.date_handover  || "",
    model:          initial.model          || "",
    serial_number:  initial.serial_number  || "",
    note:           initial.note           || "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);
      const res = await fetch(`${API}/admin/galaxy-try/si/${encodeURIComponent(initial.submission_id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(form)
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

  const Field = ({name,label,type="text"}) => (
    <label className="text-sm">
      <div className="mb-1">{label}</div>
      <input
        type={type}
        className="border rounded px-2 py-1 w-full"
        value={form[name] ?? ""}
        onChange={e => setForm(s => ({...s, [name]: e.target.value}))}
      />
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
        <Field name="date_contacted" label="Contacted At" type="date" />
        <Field name="date_handover"  label="Handover At"  type="date" />
        <Field name="model"          label="Model" />
        <Field name="serial_number"  label="Serial Number" />
        <Field name="note"           label="Note" />
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
    date_contacted: "", date_handover: "",
    model: "", serial_number: "", note: ""
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);
      const res = await fetch(`${API}/admin/galaxy-try/si`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(form)
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

  const Field = ({name,label,type="text"}) => (
    <label className="text-sm">
      <div className="mb-1">{label}</div>
      <input
        type={type}
        className="border rounded px-2 py-1 w-full"
        value={form[name] ?? ""}
        onChange={e => setForm(s => ({...s, [name]: e.target.value}))}
      />
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
        <Field name="date_contacted" label="Contacted At" type="date" />
        <Field name="date_handover"  label="Handover At"  type="date" />
        <Field name="model"          label="Model" />
        <Field name="serial_number"  label="Serial Number" />
        <Field name="note"           label="Note" />
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

export default withAuth(GalaxyTrySIPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });