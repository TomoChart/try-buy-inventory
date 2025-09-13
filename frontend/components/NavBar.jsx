import Link from "next/link";
import { useRouter } from "next/router";
import { getToken, parseJwt, TOKEN_KEY } from "../lib/auth";

export default function NavBar() {
  const router = useRouter();
  let role = null;
  try {
    const token = getToken();
    if (token) {
      const user = parseJwt(token);
      role = user?.role;
    }
  } catch {}

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    window.location.assign("/login");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
      <div className="font-bold text-lg tracking-wide">TryBuy Inventory</div>
      <div className="flex items-center gap-4">
        {role === "SUPERADMIN" && (
          <Link href="/admin" className="text-blue-600 hover:underline font-medium">Admin</Link>
        )}
        <button
          onClick={handleLogout}
          className="ml-2 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
