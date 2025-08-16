// pages/c/[code]/dashboard.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppLayout from "../../../components/AppLayout";
import { getCurrentUser, API } from "../../../lib/auth";

const Card = ({ title, value }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5">
    <div className="text-xs text-slate-500">{title}</div>
    <div className="text-3xl font-bold mt-1">{value}</div>
  </div>
);

export default function CountryDashboard() {
  const router = useRouter();
  const { code } = router.query || {};
  const user = getCurrentUser();

  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // auth guard
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) router.replace("/login");
  }, [user, router]);

  // fetch KPI kad imamo code iz URL-a
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!code) return;
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`${API}/stats?code=${encodeURIComponent(String(code))}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setKpi(data?.kpi ?? null);
      } catch (e) {
        if (mounted) setErr("Ne mogu dohvatiti statistiku.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [code]);

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-3">
        Dashboard — {(code || "").toString().toUpperCase()}
      </h1>

      {loading && <div className="text-slate-600">Učitavam KPI…</div>}
      {err && <div className="text-red-600 mb-3">{err}</div>}

      {!loading && !err && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="Aktivni uređaji" value={kpi?.devicesActive ?? "—"} />
          <Card title="Aktivne Try_and_Buy" value={kpi?.tryAndBuyActive ?? "—"} />
          <Card title="Galaxy Try (Fold7) aktivacije" value={kpi?.galaxyTryActivations ?? "—"} />
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-600 mb-2">Brzi linkovi</h3>
        <ul className="list-disc list-inside text-slate-700">
          <li><a className="underline" href="/galaxy-try">Galaxy Try (Fold7)</a></li>
          <li><a className="underline" href="/try-and-buy">Try_and_Buy</a></li>
          <li><a className="underline" href="/devices">Uređaji</a></li>
          <li><a className="underline" href="/btl">BTL evidencija</a></li>
        </ul>
      </div>
    </AppLayout>
  );
}
