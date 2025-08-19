import AdminPanel from '../components/AdminPanel'; // prilagodi putanju ako je drugačije
import { getToken, parseJwt } from '../lib/auth';

export default function AdminPage() {
  // Dohvati token i rolu iz auth storea
  const token = typeof window !== 'undefined' ? getToken() : null;
  const user = token ? parseJwt(token) : null;
  const role = (user?.role || '').toUpperCase();

  return <AdminPanel token={token} userRole={role} baseUrl="https://api.try-buy-inv.net" />;
}
