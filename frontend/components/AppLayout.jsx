// components/AppLayout.jsx
import Link from "next/link";
import { useRouter } from "next/router";
import CountrySwitcher from "./CountrySwitcher";
import { getCurrentUser, getToken, parseJwt } from "../lib/auth";
import { useActiveCountryCode } from "../lib/route";

const NavLink = ({ href, active, children }) => (
  <Link
    href={href}
    className={[
      "block rounded-xl px-3.5 py-2.5 text-sm font-medium",
      active ? "bg-indigo-50 text-indigo-700" : "text-slate-800 hover:bg-slate-100"
    ].join(" ")}
  >
    {children}
  </Link>
);

export default function AppLayout({ children }) {
  const router = useRouter();
  const user = getCurrentUser();
  const token = getToken();
  const p = router.asPath;
  const activeCode = useActiveCountryCode();
  const withCode = (slug) => (activeCode ? `/c/${activeCode}${slug}` : slug);

  if (typeof window !== "undefined" && !user && router.pathname !== "/login") {
    router.replace("/login");
    return null;
  }

  // PRIMJER niza linkova:
  const nav = [
    { href: "/devices", label: "Uređaji" },
    { href: "/galaxy-try/hr", label: "Galaxy Try" },
    { href: "/adminusers", label: "adminusers", roles: ["SUPERADMIN", "COUNTRY_ADMIN"] }, // NOVO
  ];

  const t = getToken();
  const u = t ? parseJwt(t) : {};
  const role = String(u?.role || "").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="bg-white border-r border-slate-200 p-4">
        <h3 className="text-lg font-semibold mb-4 pl-1">Try-Buy Inventory</h3>
        <div className="mt-2">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 pl-1">Nodovi</div>
          {/* Render linkova s role-filterom */}
          {nav
            .filter(item => !item.roles || item.roles.includes(role))
            .map(item => (
              <Link key={item.href} href={item.href} className="block mb-2 px-2 py-1 rounded hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
        </div>
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 pl-1">Admin</div>
          <NavLink href="/admin/users" active={p.startsWith("/admin/users")}>Korisnici</NavLink>
          <NavLink href="/settings" active={p.startsWith("/settings")}>Postavke</NavLink>
        </div>
      </aside>
      {/* Main */}
      <main className="flex flex-col">
        {/* Topbar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Try-Buy</div>
          <div className="flex items-center gap-3">
            <CountrySwitcher />
            <button
              onClick={() => { localStorage.removeItem("you_token"); window.location.href = "/login"; }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </main>
    </div>
  );
}
