import { useEffect, useState } from "react";
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
        <button
          onClick={() => router.back()}
          className="px-3 py-2 border rounded hover:bg-gray-50"
        >
          ← Back
        </button>

        <h1 className="text-xl font-bold">Galaxy Try — HR</h1>

        <button
          className="px-3 py-2 bg-blue-600 text-white rounded"
          onClick={() => setShowImport(true)}
        >
          Import CSV
        </button>
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
<th className="p-2 text-left">Pickup City</th>
<th className="p-2 text-left">Created At</th>
<th className="p-2 text-left">Contacted At</th>
<th className="p-2 text-left">Handover At</th>
    <th className="p-2 text-left">Model</th>
    <th className="p-2 text-left">Serial Number</th> 
        <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <EditableRow
                  key={r.submission_id}
                  row={r}
                  onSave={async (updated) => {
                    // PATCH na backend
                    const res = await fetch(`${API}/admin/galaxy-try/hr/${r.submission_id}`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${getToken()}`
                      },
                      body: JSON.stringify(updated)
                    });
                    if (res.ok) {
                      // osvježi red u rows
                      const newRows = [...rows];
                      newRows[idx] = { ...r, ...updated };
                      setRows(newRows);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <CsvImportModal
          onClose={() => { setShowImport(false); load(); }}
          countryCode="HR"
          kind="leads"     // <-- za Galaxy Try
        />
      )}
    </div>
  );
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

export default withAuth(GalaxyTryHRPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });
