import { useEffect } from "react";
import { getToken, parseJwt } from "../lib/auth";
import countryCodeById from "../lib/auth";
import withAuth from "../lib/withAuth";

function Dashboard() {
  useEffect(() => {
    const token = getToken();
    const user = token ? parseJwt(token) : null;
    if (user) {
      if (user.countryId) {
        (async () => {
          const code = await countryCodeById(user.countryId, token);
          if (code) window.location.assign(`/c/${code}/dashboard`);
        })();
        return;
      }
      if (String(user.role).toUpperCase() === "SUPERADMIN") {
        window.location.assign("/admin");
        return;
      }
    }
  }, []);
  return (
    <div className="p-8 text-center text-lg font-semibold">Global dashboard</div>
  );
}

export default withAuth(Dashboard);
