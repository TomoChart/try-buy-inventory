import AppLayout from "../components/AppLayout";
import { getToken, parseJwt, TOKEN_KEY } from "../lib/auth";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      window.location.assign("/login"); // hard redirect
      return;
    }
    const u = parseJwt(t);
    if (!u) {
      window.location.assign("/login");
      return;
    }
    setUser(u);
  }, []);

  if (!user) return null; // kratko dok čitamo token

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-3">Dashboard</h1>
      <p className="text-slate-600">Dobrodošli, {user.email}!</p>
      <div className="mt-6">
        <button
          onClick={() => {
            // briši točan ključ, ne "you_token"
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
