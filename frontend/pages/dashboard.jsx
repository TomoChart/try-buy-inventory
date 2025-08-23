import { useEffect } from "react";
import { getToken, parseJwt, countryCodeById } from "../lib/auth";
import withAuth from "../components/withAuth";

function Dashboard() {
  useEffect(() => {
    (async () => {
      const t = getToken();
      const u = parseJwt(t);
      if (!u) { window.location.assign("/login"); return; }

      if (u.countryId) {
        const code = await countryCodeById(u.countryId, t);
        if (code) { window.location.assign(`/c/${code.toLowerCase()}/dashboard`); return; }
      }
      if ((u.role || "").toUpperCase() === "SUPERADMIN") {
        window.location.assign("/admin"); return;
      }
      // inače ostani na globalnom /dashboard
    })();
  }, []);

  return <div className="p-4">Globalni dashboard (bez zemlje)</div>;
}

export default withAuth(Dashboard);
