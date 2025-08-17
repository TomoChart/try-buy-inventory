
import { useState } from 'react';
import { useRouter } from 'next/router';
import { API } from '../lib/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { token } = router.query;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!token || !newPassword) {
      setError('Token i nova lozinka su obavezni.');
      return;
    }
    const res = await fetch(`${API}/auth/dev-reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (data.success) {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setError(data.error || 'Greška pri resetiranju lozinke.');
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Unesi novu lozinku</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {success ? (
        <div className="text-green-600 mb-2">Lozinka je promijenjena! Preusmjeravanje...</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="w-full mb-4 p-2 border rounded"
            placeholder="Nova lozinka"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Postavi lozinku
          </button>
        </form>
      )}
    </div>
  );
}
