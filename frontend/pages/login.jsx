// frontend/pages/login.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { LoginForm } from "../components/LoginForm";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => { setReady(true); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL;
      const r = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!r.ok) throw new Error("Bad credentials");
      const data = await r.json();
      window.localStorage.setItem("you_token", data.token);
      // --- REDIRECT LOGIKA ---
      const jwt = JSON.parse(atob(data.token.split('.')[1]));
      if (jwt.countryId) {
        // Dohvati code za countryId
        const cres = await fetch(`${base}/countries`);
        const countries = await cres.json();
        const country = countries.find(c => c.id === jwt.countryId);
        if (country && country.code) {
          router.replace(`/c/${country.code.toLowerCase()}/dashboard`);
        } else {
          router.replace('/dashboard'); // fallback
        }
      } else if (jwt.role === 'superadmin' && !jwt.countryId) {
        router.replace('/select-country');
      } else {
        router.replace('/dashboard');
      }
      // --- END REDIRECT LOGIKA ---
    } catch (err) {
      alert("Login failed");
    }
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fuchsia-700 to-indigo-500">
      <div className="bg-blue-600 rounded-2xl shadow-lg p-9 min-w-[340px]">
        <h1 className="text-white mb-6 text-center text-2xl font-bold">Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-lg border border-gray-300 p-2"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pr-9 rounded-lg border border-gray-300 p-2"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer p-0"
              aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
            >
              {showPassword ? (
                <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.09-2.73 2.99-4.98 5.38-6.36M6.06 6.06A9.97 9.97 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.06 5.94M1 1l22 22"/><circle cx="12" cy="12" r="3"/></svg>
              ) : (
                <svg width="22" height="22" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="7"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            className="bg-fuchsia-700 hover:bg-fuchsia-800 text-white rounded-lg p-3 font-semibold text-lg mt-2"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
