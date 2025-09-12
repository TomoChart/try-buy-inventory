import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function toDateOnly(value) {
  if (!value) return "";
  try { return new Date(value).toISOString().slice(0, 10); } catch { return ""; }
}
function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d) ? null : d;
}
function toIsoOrNull(d) {
  if (!d) return null;
  try { return new Date(d).toISOString(); } catch { return null; }
}

function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // editable fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [note, setNote] = useState("");

  // date pickers
  const [contactedAt, setContactedAt] = useState(null);
  const [handoverAt, setHandoverAt] = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`${API}/admin/galaxy-try/hr/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Fetch failed");
        setRow(data);

        // map backend HR keys -> local state
        setEmail(data["E-mail"] ?? "");
        setPhone(data["Telefon"] ?? "");
        setPickupCity(data["Grad preuzimanja"] ?? data["Pickup City"] ?? "");
        setModel(data["Model"] ?? "");
        setSerial(data["IMEI"] ?? "");
        setNote(data["Bilješka"] ?? "");

        setContactedAt(toDateOrNull(data["Kontaktiran"]));
        setHandoverAt(toDateOrNull(data["Predaja uređaja"]));
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [id]);

  async function save() {
    try {
      setSaving(true); setErr("");
      const body = {
        email: email || null,
        phone: phone || null,
        pickup_city: pickupCity || null,
        contacted: toIsoOrNull(contactedAt),
        handover_at: toIsoOrNull(handoverAt),
        model: model || null,
        imei: serial || null,
        note: note || null,
      };
      const r = await fetch(`${API}/admin/galaxy-try/hr/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Save failed");

      // refresh minimalno
      router.replace(router.asPath);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="px-3 py-2 border rounded hover:bg-gray-50">← Back</button>
        <h1 className="text-xl font-bold">Galaxy Try — HR / Detail</h1>
        <div />
      </div>

      {err && <div className="text-red-600">{err}</div>}
      {!row ? (
        <div>Loading…</div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {/* READ-ONLY header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
            <Field k="Submission ID" v={row["Submission ID"] || id} />
            {/* Created At samo datum */}
            <Field k="Created At" v={toDateOnly(row["Datum prijave"] || row["Created At"])} />
            <Field k="Country" v={row["Zemlja"] || "HR"} />
          </div>

          {/* EDITABLE form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledInput label="Email">
              <input className="w-full border rounded px-2 py-1" value={email} onChange={(e)=>setEmail(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Phone">
              <input className="w-full border rounded px-2 py-1" value={phone} onChange={(e)=>setPhone(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Pickup City">
              {/* ako želiš dropdown, stavi options; zasad text */}
              <input className="w-full border rounded px-2 py-1" value={pickupCity} onChange={(e)=>setPickupCity(e.target.value)} placeholder="Zagreb / Split" />
            </LabeledInput>

            <LabeledInput label="Model">
              <input className="w-full border rounded px-2 py-1" value={model} onChange={(e)=>setModel(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="IMEI">
              <input className="w-full border rounded px-2 py-1" value={serial} onChange={(e)=>setSerial(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Contacted At">
              <DatePicker
                selected={contactedAt}
                onChange={(d)=>setContactedAt(d)}
                dateFormat="yyyy-MM-dd"
                isClearable
                className="w-full border rounded px-2 py-1"
                placeholderText="YYYY-MM-DD"
              />
            </LabeledInput>

            <LabeledInput label="Handover At">
              <DatePicker
                selected={handoverAt}
                onChange={(d)=>setHandoverAt(d)}
                dateFormat="yyyy-MM-dd"
                isClearable
                className="w-full border rounded px-2 py-1"
                placeholderText="YYYY-MM-DD"
              />
            </LabeledInput>

            <LabeledInput label="Note" full>
              <textarea className="w-full border rounded px-2 py-1" rows={4} value={note} onChange={(e)=>setNote(e.target.value)} />
            </LabeledInput>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ k, v }) {
  return (
    <div>
      <div className="text-gray-500">{k}</div>
      <div className="font-medium break-words">{v ?? ""}</div>
    </div>
  );
}

function LabeledInput({ label, children, full=false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}

export default withAuth(DetailPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });
