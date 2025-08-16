// pages/select-country.jsx
import AppLayout from "../components/AppLayout";
import CountrySwitcher from "../components/CountrySwitcher";
import { getCurrentUser } from "../lib/auth";

export default function SelectCountry() {
  const user = getCurrentUser();
  return (
    <AppLayout>
      <h1>Odaberi zemlju</h1>
      {!user || user.role !== "superadmin" ? (
        <p>Ova stranica je za superadmin korisnike.</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <CountrySwitcher />
          <p style={{ marginTop: 12, color: "#666" }}>Odaberi zemlju iz padajućeg izbornika.</p>
        </div>
      )}
    </AppLayout>
  );
}
