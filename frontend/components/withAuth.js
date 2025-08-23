import { useEffect, useState } from "react";
import { getToken, parseJwt } from "../lib/auth";

export default function withAuth(Page, opts = {}) {
  const needRoles = (opts.roles || []).map((r) => String(r).toUpperCase());
  return function Guarded(props) {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      const t = getToken(); // sessionStorage || localStorage, ključ "jwt"
      if (!t) {
        window.location.assign("/login");
        return;
      }
      if (needRoles.length) {
        const u = parseJwt(t) || {};
        const role = String(u.role || "").toUpperCase();
        if (!needRoles.includes(role)) {
          window.location.assign("/login");
          return;
        }
      }
      setReady(true);
    }, []);
    if (!ready) return null;
    return <Page {...props} />;
  };
}
