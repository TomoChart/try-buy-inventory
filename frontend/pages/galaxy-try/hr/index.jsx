import { useEffect, useState, useRef } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";
import CsvImportModal from "../../../components/CsvImportModal";
import { useRouter } from "next/router";


function GalaxyTryHRPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showImport, setShowImport] = useState(false);
  const router = useRouter();

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
    const r = await fetch(`${API}/admin/galaxy-try/hr/${id}`, {
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


  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/admin/galaxy-try/hr/list`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } catch {
      setErr("Can't fetch applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
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
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">First Name</th>
                <th className="p-2 text-left">Last Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Phone</th>
                <th className="p-2 text-left">Address</th>      {/* NOVO */}
                <th className="p-2 text-left">City</th>         {/* NOVO */}
                <th className="p-2 text-left">Pickup City</th>
                <th className="p-2 text-left">Created At</th>
                <th className="p-2 text-left">Contacted At</th>
                <th className="p-2 text-left">Handover At</th>
                <th className="p-2 text-left">Days left</th>    {/* NOVO */}
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Serial Number</th>
                <th className="p-2 text-left">Note</th>         {/* NOVO */}
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const left = daysLeft(r.date_handover);
                const leftStyle = (left === 0) ? { backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: 600 } : {};
                return (
                  <tr key={r.submission_id}>
                    <td>{r.first_name ?? "-"}</td>
                    <td>{r.last_name ?? "-"}</td>
                    <td>{r.email ?? "-"}</td>
                    <td>{r.phone ?? "-"}</td>
                    <td>{r.address ?? "-"}</td>
                    <td>{r.city ?? "-"}</td>
                    <td>{r.pickup_city ?? "-"}</td>
                    <td>{fmtDateDMY(r.created_at)}</td>
                    <td>{fmtDateDMY(r.date_contacted)}</td>
                    <td>{fmtDateDMY(r.date_handover)}</td>
                    <td style={leftStyle}>{left === "" ? "" : left}</td>
                    <td>{r.model ?? "-"}</td>
                    <td>{r.serial_number ?? "-"}</td>
                    <td>{r.note ?? "-"}</td>
                    <td>
                      {/* Ovdje možeš staviti akcije (edit, save, itd.) */}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

    const endpoint = `${API}/admin/galaxy-try/HR/import?mode=upsert`;
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

export default withAuth(GalaxyTryHRPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });
