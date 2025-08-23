// frontend/pages/login.js
import { useEffect, useState } from 'react'
import LoginForm from "../components/LoginForm";
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
  <h3 className="text-lg font-bold mb-2">Generiraj novu lozinku</h3>
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
            {loading ? "Generiram..." : "Generiraj novu lozinku"}
          </button>
        </form>
        {resetResult && (
          <div className="bg-gray-100 p-2 rounded text-xs break-all mt-2">
            {resetResult.newPassword ? (
              <>
                <div className="mb-1 font-semibold text-green-700">Nova lozinka:</div>
                <div className="mb-2 text-lg font-mono text-green-900 select-all">{resetResult.newPassword}</div>
                <div className="text-gray-600 text-xs">Kopiraj lozinku, prijavi se s njom i odmah je promijeni u postavkama.</div>
              </>
            ) : (
              <div className="text-red-600">{resetResult.error || 'Greška.'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
import { useRouter } from 'next/router'
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
