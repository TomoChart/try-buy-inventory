import { useEffect, useState } from "react";
import withAuth from "../components/withAuth";
import AppLayout from "../components/AppLayout";
import { getToken, parseJwt, TOKEN_KEY } from "../lib/auth";

function DashboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const t = getToken();
    if (!t) { window.location.assign("/login"); return; }
    const u = parseJwt(t);
    if (!u) { window.location.assign("/login"); return; }
    setUser(u);
  }, []);

  if (!user) return null;

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-3">Dashboard</h1>
      <p className="text-slate-600">Dobrodošli, {user.email}!</p>
      <div className="mt-6">
        <button
          onClick={() => {
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            window.location.assign("/login");
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </AppLayout>
  );
}

export default withAuth(DashboardPage);
