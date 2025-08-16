// pages/c/[code]/dashboard.jsx
import { useRouter } from "next/router";
import AppLayout from "../../../components/AppLayout";
import { getCurrentUser } from "../../../lib/auth";

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
      <h1 style={{ marginBottom: 8 }}>Dashboard — {String(code).toUpperCase()}</h1>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, minmax(200px, 1fr))" }}>
        <KPI title="Aktivni uređaji" value="—" />
        <KPI title="Aktivne Try_and_Buy" value="—" />
        <KPI title="Galaxy Try (Fold7) aktivacije" value="—" />
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Brzi linkovi</h3>
        <ul>
          <li><a href="/galaxy-try">Galaxy Try (Fold7)</a></li>
          <li><a href="/try-and-buy">Try_and_Buy</a></li>
          <li><a href="/devices">Uređaji</a></li>
          <li><a href="/btl">BTL evidencija</a></li>
        </ul>
      </div>
    </AppLayout>
  );
}

function KPI({ title, value }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
