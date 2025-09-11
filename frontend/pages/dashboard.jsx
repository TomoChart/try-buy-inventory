import { useEffect, useState } from "react";
import Link from "next/link";
import withAuth from "../components/withAuth";
import { getToken, parseJwt, countryCodeById } from "../lib/auth";

function DashboardPage() {
  const [code, setCode] = useState("hr");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = getToken();
        const u = t ? parseJwt(t) : null;
        if (u?.countryId) {
          const c = await countryCodeById(u.countryId, t);
          if (!cancelled && c) setCode(String(c).toLowerCase());
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const galaxyHref = `/galaxy-try/${code}`;
  const devicesHref = `/devices?country=${code}`;

  return (
    <div className="min-h-screen grid grid-cols-2 bg-gradient-to-br from-samsung-blue to-black">
      <Link href={galaxyHref} className="relative block group">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/Background galaxytry.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
        <div className="relative flex h-full items-center justify-center text-white text-4xl font-bold">
          GALAXY TRY
        </div>
      </Link>
      <Link href={devicesHref} className="relative block group">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/Background foldables.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
        <div className="relative flex h-full items-center justify-center text-white text-4xl font-bold">
          DEVICES
        </div>
      </Link>
    </div>
  );
}

export default withAuth(DashboardPage);
