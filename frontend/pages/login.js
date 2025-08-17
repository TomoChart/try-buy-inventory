// frontend/pages/login.js
import { useEffect, useState } from 'react'
// DEV reset password modal
function DevResetModal({ onClose, backendUrl }) {
  const [resetEmail, setResetEmail] = useState("");
  const [resetResult, setResetResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleResetRequest(e) {
    e.preventDefault();
    setResetResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/auth/dev-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail })
      });
      const data = await res.json();
      setResetResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-white p-6 rounded-2xl shadow-lg max-w-sm w-full relative border-2 border-blue-400">
        <button className="absolute top-2 right-2 text-gray-400 text-2xl" onClick={onClose}>&times;</button>
        <h3 className="text-lg font-bold mb-2">Reset lozinke (DEV)</h3>
        <form onSubmit={handleResetRequest}>
          <input
            type="email"
            className="w-full mb-2 p-2 border rounded"
            placeholder="Unesi email"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-2" disabled={loading}>
            {loading ? "Generiram..." : "Generiraj reset link"}
          </button>
        </form>
        {resetResult && (
          <div className="bg-gray-100 p-2 rounded text-xs break-all mt-2">
            <div className="mb-1">Reset link/token:</div>
            <div className="mb-2"><code>{resetResult.resetUrl || resetResult.error}</code></div>
            {resetResult.resetUrl && (
              <a href={resetResult.resetUrl} className="text-blue-600 underline" onClick={onClose}>
                Otvori stranicu za unos nove lozinke
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
import { useRouter } from 'next/router'

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [showReset, setShowReset] = useState(false);
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

  const base = process.env.NEXT_PUBLIC_BACKEND_URL;

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
        <div className="mt-6 flex justify-center">
          <button
            className="text-sm text-white font-semibold hover:text-pink-200 transition-colors duration-150 underline underline-offset-4"
            onClick={() => setShowReset(true)}
            type="button"
          >
            Zaboravljena lozinka?
          </button>
        </div>
        {showReset && <DevResetModal onClose={() => setShowReset(false)} backendUrl={base} />}
      </div>
    </main>
  );
}
