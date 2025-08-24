// frontend/pages/index.js
import { useEffect } from "react";
import { useRouter } from "next/router";
import { getToken, parseJwt, countryCodeById } from "../lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const t = getToken();
      if (!t) { router.replace("/login"); return; }

      const u = parseJwt(t) || {};

      // ako korisnik ima countryId → vodi na /c/{code}/dashboard
      if (u.countryId) {
        const code = await countryCodeById(u.countryId, t);
        if (code) { router.replace(`/c/${code.toLowerCase()}/dashboard`); return; }
      }

      // SUPERADMIN bez zemlje → neka odabere zemlju
      const role = String(u.role || "").toUpperCase();
      if (role === "SUPERADMIN") { router.replace("/select-country"); return; }

      // fallback
      router.replace("/dashboard");
    })();
  }, [router]);

  return null; // nema flickera – samo čisti redirect
}
