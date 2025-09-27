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
function toIsoDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${day}T00:00:00Z`).toISOString();
}

function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [note, setNote] = useState("");
  const [daysLeft, setDaysLeft] = useState("");
  const [finished, setFinished] = useState(false);
  const [userFeedback, setUserFeedback] = useState("");
  const [countryCode, setCountryCode] = useState("");

  // date pickers
  const [contactedAt, setContactedAt] = useState(null);
  const [handoverAt, setHandoverAt] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);

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
        setFirstName(data["First Name"] ?? data.first_name ?? "");
        setLastName(data["Last Name"] ?? data.last_name ?? "");
        setEmail(data["E-mail"] ?? data.email ?? "");
        setPhone(data["Phone"] ?? data.phone ?? "");
        setAddress(data["Address"] ?? data.address ?? "");
        setCity(data["City"] ?? data.city ?? "");
        setPickupCity(data["Grad preuzimanja"] ?? data["Pickup City"] ?? data.pickup_city ?? "");
        setModel(data["Model"] ?? data.model ?? "");
        setSerial(data["Serial"] ?? data.serial ?? "");
        setNote(data["Note"] ?? data.note ?? "");
        setCountryCode(data["Zemlja"] ?? data["Country Code"] ?? data.country_code ?? "");

        const rawDays = data["Days Left"] ?? data.days_left;
        setDaysLeft(rawDays === null || rawDays === undefined || rawDays === "" ? "" : String(rawDays));

        const finishedRaw = data["Finished"] ?? data.finished ?? data["Returned"] ?? data.returned;
        const finishedNormalized = typeof finishedRaw === "string"
          ? finishedRaw.trim().toLowerCase()
          : finishedRaw;
        setFinished(Boolean(
          finishedNormalized && finishedNormalized !== "no" && finishedNormalized !== "0"
        ));
        setUserFeedback(data["User Feedback"] ?? data.user_feedback ?? "");

        setContactedAt(toDateOrNull(data["Contacted"]));
        setHandoverAt(toDateOrNull(data["Handover"]));
        setCreatedAt(toDateOrNull(data["Created_at"] || data["Created At"]));
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [id]);

  async function save() {
    try {
      setSaving(true); setErr("");
      const parsedDays = Number(daysLeft);
      const normalizedDays = daysLeft === "" ? null : (Number.isFinite(parsedDays) ? parsedDays : null);
      const body = {
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        pickup_city: pickupCity || null,
        contacted: toIsoOrNull(contactedAt),
        created_at: toIsoDateOnly(createdAt),
        handover_at: toIsoOrNull(handoverAt),
        days_left: normalizedDays,
        model: model || null,
        serial: serial || null,
        note: note || null,
        finished,
        user_feedback: userFeedback || null,
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm mb-4">
            <Field k="Submission ID" v={row["Submission ID"] || id} />
            {/* Created At samo datum */}
            <Field k="Created At" v={toDateOnly(row["Datum prijave"] || row["Created At"])} />
            <Field k="Country" v={countryCode || row["Zemlja"] || row["Country"] || ""} />
            <Field k="Days Left" v={daysLeft || row["Days Left"] || ""} />
          </div>

          {/* EDITABLE form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledInput label="First Name">
              <input className="w-full border rounded px-2 py-1" value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Last Name">
              <input className="w-full border rounded px-2 py-1" value={lastName} onChange={(e)=>setLastName(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Email">
              <input className="w-full border rounded px-2 py-1" value={email} onChange={(e)=>setEmail(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Phone">
              <input className="w-full border rounded px-2 py-1" value={phone} onChange={(e)=>setPhone(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Address">
              <input className="w-full border rounded px-2 py-1" value={address} onChange={(e)=>setAddress(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="City">
              <input className="w-full border rounded px-2 py-1" value={city} onChange={(e)=>setCity(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Pickup City">
              {/* ako želiš dropdown, stavi options; zasad text */}
              <input className="w-full border rounded px-2 py-1" value={pickupCity} onChange={(e)=>setPickupCity(e.target.value)} placeholder="Zagreb / Split" />
            </LabeledInput>
<LabeledInput label="Created At">
  <DatePicker
    selected={createdAt}
    onChange={(d)=>setCreatedAt(d)}
    dateFormat="yyyy-MM-dd"
    isClearable
    className="w-full border rounded px-2 py-1"
    placeholderText="YYYY-MM-DD"
  />
</LabeledInput>

            <LabeledInput label="Model">
              <input className="w-full border rounded px-2 py-1" value={model} onChange={(e)=>setModel(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Serial">
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

            <LabeledInput label="Days Left">
              <input className="w-full border rounded px-2 py-1" type="number" value={daysLeft} onChange={(e)=>setDaysLeft(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="Finished">
              <input type="checkbox" className="w-4 h-4" checked={finished} onChange={(e)=>setFinished(e.target.checked)} />
            </LabeledInput>

            <LabeledInput label="Note" full>
              <textarea className="w-full border rounded px-2 py-1" rows={4} value={note} onChange={(e)=>setNote(e.target.value)} />
            </LabeledInput>

            <LabeledInput label="User Feedback" full>
              <textarea className="w-full border rounded px-2 py-1" rows={4} value={userFeedback} onChange={(e)=>setUserFeedback(e.target.value)} />
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
