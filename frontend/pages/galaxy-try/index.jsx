import React, { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/router";
import withAuth from "../../components/withAuth";
import { API, getToken, parseJwt, countryCodeById } from "../../lib/auth";

function getVal(row, keys) { for (const k of keys) { const v = row[k]; if (v !== undefined && v !== null && v !== "") return v; } return ""; }
function fmtDate(v) { if (!v) return ""; const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("hr-HR"); }

function GalaxyTryPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [code, setCode] = useState("");

  const [q, setQ] = useState("");

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
        const r = await fetch(`${API}/admin/galaxy-try/${c.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("Greška pri dohvaćanju.");
        const data = await r.json();
        if (!cancelled) setRows(data || []);
      } catch (e) { if (!cancelled) setErr("Ne mogu dohvatiti prijave."); }
      finally { if (!cancelled) setLoading(false); }
    }
    load(); return () => { cancelled = true; };
  }, [router.query.country]);

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id); setDetail(null);
    try {
      const r = await fetch(`${API}/admin/galaxy-try/${code.toLowerCase()}/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error();
      setDetail(await r.json());
    } catch { setDetail({ error: "Ne mogu dohvatiti detalje." }); }
  }

  function BackBtn() { return <button onClick={() => router.back()} className="mb-3 px-3 py-1 rounded border">← Back</button>; }

  // ===== Edit modal =====
  function EditModal({ item, onClose }) {
    const id = getVal(item, ["submission_id","SubmissionID","ID","id"]);
    const [form, setForm] = useState(() => ({
      first_name: getVal(item, ["Ime","first_name"]),
      last_name:  getVal(item, ["Prezime","last_name"]),
      email:      getVal(item, ["E-mail","email"]),
      phone:      getVal(item, ["Telefon","phone"]),
      address:    getVal(item, ["Adresa","address"]),
      city:       getVal(item, ["Grad","city"]),
      postal_code:getVal(item, ["Pošta","postal_code"]),
      date_contacted: getVal(item, ["Contacted","date_contacted"]),
      date_handover:  getVal(item, ["Datum predaje","date_handover"]),
      model:      getVal(item, ["Model","model"]),
      serial_number: getVal(item, ["Serial","serial_number"]),
      note:       getVal(item, ["Napomena","note"]),
    }));
    const [saving, setSaving] = useState(false);

    async function save() {
      setSaving(true);
      try {
        const r = await fetch(`${API}/admin/galaxy-try/${code.toLowerCase()}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Save failed");

        const ref = await fetch(`${API}/admin/galaxy-try/${code.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${getToken()}` }});
        setRows(await ref.json());
        onClose();
      } catch(e){ alert(e.message); } finally { setSaving(false); }
    }
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[720px] max-w-[95vw]">
          <h3 className="font-semibold text-lg mb-2">Edit lead — {id}</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["first_name","Ime*"],["last_name","Prezime*"],
              ["email","E-mail"],["phone","Telefon"],
              ["address","Adresa"],["city","Grad"],["postal_code","Pošta"],
              ["date_contacted","Contacted (YYYY-MM-DD)"],["date_handover","Datum predaje (YYYY-MM-DD)"],
              ["model","Model"],["serial_number","Serijski broj"],
              ["note","Napomena"],
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
    const [form, setForm] = useState({ submission_id:"", first_name:"", last_name:"", email:"", phone:"", address:"", city:"", postal_code:"", date_contacted:"", date_handover:"", model:"", serial_number:"", note:"", form_name:"HR registracija" });
    const [saving, setSaving] = useState(false);
    async function save() {
      setSaving(true);
      try {
        const r = await fetch(`${API}/admin/galaxy-try/${code.toLowerCase()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Create failed");

        const ref = await fetch(`${API}/admin/galaxy-try/${code.toLowerCase()}/list`, { headers: { Authorization: `Bearer ${getToken()}` }});
        setRows(await ref.json());
        onClose();
      } catch(e){ alert(e.message); } finally { setSaving(false); }
    }
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[720px] max-w-[95vw]">
          <h3 className="font-semibold text-lg mb-2">Add lead — {code}</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["submission_id","Submission ID*"],["first_name","Ime*"],["last_name","Prezime*"],
              ["email","E-mail"],["phone","Telefon"],
              ["address","Adresa"],["city","Grad"],["postal_code","Pošta"],
              ["date_contacted","Contacted (YYYY-MM-DD)"],["date_handover","Datum predaje (YYYY-MM-DD)"],
              ["model","Model"],["serial_number","Serijski broj"],
              ["note","Napomena"],["form_name","Form name"]
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

  if (loading) return <div className="p-6">Učitavam…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  const filtered = rows.filter(r => {
    if (!q) return true;
    const hay = [
      getVal(r,["Ime","first_name"]),
      getVal(r,["Prezime","last_name"]),
      getVal(r,["E-mail","email"]),
      getVal(r,["Telefon","phone"]),
      getVal(r,["Adresa","address"]),
      getVal(r,["Grad","city"]),
      getVal(r,["Pošta","postal_code"]),
      getVal(r,["Model","model"]),
      getVal(r,["Serial","serial_number"])
    ].map(x => String(x || "").toLowerCase()).join("|");
    return hay.includes(q.trim().toLowerCase());
  });

  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="p-6">
      <BackBtn />
      <h1 className="text-xl font-bold mb-2">Galaxy Try — {code}</h1>

      <div className="mb-2 flex items-center gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" className="border rounded px-2 py-1" />
        <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>setAdding(true)}>+ Add lead</button>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Ime</th>
              <th className="text-left p-2">Prezime</th>
              <th className="text-left p-2">E-mail</th>
              <th className="text-left p-2">Telefon</th>
              <th className="text-left p-2">Adresa</th>
              <th className="text-left p-2">Grad</th>
              <th className="text-left p-2">Pošta</th>
              <th className="text-left p-2">Contacted</th>
              <th className="text-left p-2">Datum predaje</th>
              <th className="text-left p-2">Model</th>
              <th className="text-left p-2">Serijski broj</th>
              <th className="text-left p-2">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => {
              const id = getVal(r, ["submission_id","SubmissionID","ID","id"]) || idx;
              return (
                <Fragment key={id}>
                  <tr className="border-t hover:bg-gray-50">
                    <td className="p-2">{getVal(r,["Ime","first_name"])}</td>
                    <td className="p-2">{getVal(r,["Prezime","last_name"])}</td>
                    <td className="p-2">{getVal(r,["E-mail","email"])}</td>
                    <td className="p-2">{getVal(r,["Telefon","phone"])}</td>
                    <td className="p-2">{getVal(r,["Adresa","address"])}</td>
                    <td className="p-2">{getVal(r,["Grad","city"])}</td>
                    <td className="p-2">{getVal(r,["Pošta","postal_code"])}</td>
                    <td className="p-2">{fmtDate(getVal(r,["Contacted","date_contacted"]))}</td>
                    <td className="p-2">{fmtDate(getVal(r,["Datum predaje","date_handover"]))}</td>
                    <td className="p-2">{getVal(r,["Model","model"])}</td>
                    <td className="p-2">{getVal(r,["Serial","serial_number"])}</td>
                    <td className="p-2">
                      <button className="px-2 py-1 rounded bg-blue-600 text-white" onClick={() => toggleExpand(id)}>
                        {expanded === id ? "Sakrij" : "Detalji"}
                      </button>
                      <button className="ml-2 px-2 py-1 rounded bg-amber-600 text-white" onClick={() => setEditing(r)}>Edit</button>
                    </td>
                  </tr>
                  {expanded === id && (
                    <tr className="bg-gray-50">
                      <td colSpan={12} className="p-3">
                        {!detail && <div>Učitavam detalje…</div>}
                        {detail && detail.error && <div className="text-red-600">{detail.error}</div>}
                        {detail && !detail.error && <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(detail, null, 2)}</pre>}
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

export default withAuth(GalaxyTryPage, { roles: ["country_admin", "superadmin"] });
