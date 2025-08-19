import AppLayout from "../components/AppLayout";
import { getCurrentUser, getToken } from "../lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();
  const user = getCurrentUser();
  const token = getToken();

  useEffect(() => {
    const t = getToken();
    if (!t) {
      window.location.assign("/login"); // hard redirect
    }
  }, []);

  if (!user) return null;

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-3">Dashboard</h1>
      <p className="text-slate-600">Dobrodošli, {user.email}!</p>
      <div className="mt-6">
        <button
          onClick={() => {
            localStorage.removeItem("you_token");
            sessionStorage.removeItem("you_token");
            window.location.href = "/login";
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </AppLayout>
  );
}
