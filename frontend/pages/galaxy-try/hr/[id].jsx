import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import withAuth from "../../../components/withAuth";
import { API, getToken } from "../../../lib/auth";

function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const [err, setErr] = useState("");

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
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [id]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Field k="Submission ID" v={row["Submission ID"] || id} />
            <Field k="Created At" v={row["Datum prijave"] ? new Date(row["Datum prijave"]).toISOString().slice(0,10) : ""} />

            <Field k="First Name" v={row["Ime"]} />
            <Field k="Last Name" v={row["Prezime"]} />
            <Field k="Email" v={row["E-mail"]} />
            <Field k="Phone" v={row["Telefon"]} />
            <Field k="Address" v={row["Adresa"]} />
            <Field k="City" v={row["Grad"]} />
            <Field k="Postal Code" v={row["Poštanski broj"]} />
            <Field k="Pickup City" v={row["Grad preuzimanja"]} />
            <Field k="Consent" v={row["Privola"]} />

            <Field k="Contacted At" v={row["Kontaktiran"]} />
            <Field k="Handover At" v={row["Predaja uređaja"]} />
            <Field k="Model" v={row["Model"]} />
            <Field k="Serial Number" v={row["Serial Number"]} />
            <Field k="Form Name" v={row["Naziv forme"]} />
            <Field k="Country" v={row["Zemlja"]} />
            <Field k="Note" v={row["Bilješka"]} wide />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ k, v, wide=false }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="text-gray-500">{k}</div>
      <div className="font-medium">{v ?? ""}</div>
    </div>
  );
}

export default withAuth(DetailPage, { roles: ["COUNTRY_ADMIN", "SUPERADMIN"] });
