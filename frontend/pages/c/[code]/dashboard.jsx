// pages/c/[code]/dashboard.jsx
import { useRouter } from "next/router";
import AppLayout from "../../../components/AppLayout";
import { getCurrentUser } from "../../../lib/auth";

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

  // Minimalna zaštita: ako nema tokena -> login
  if (typeof window !== "undefined" && !user) {
    router.replace("/login");
    return null;
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-3">Dashboard — {(code || "").toString().toUpperCase()}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title="Aktivni uređaji" value="—" />
        <Card title="Aktivne Try_and_Buy" value="—" />
        <Card title="Galaxy Try (Fold7) aktivacije" value="—" />
      </div>

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
