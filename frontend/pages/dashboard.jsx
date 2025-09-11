import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import withAuth from "../components/withAuth";
import { getToken, parseJwt, countryCodeById } from "../lib/auth";

function DashboardPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      const user = token ? parseJwt(token) : null;
      if (!user) { window.location.assign("/login"); return; }
      let c = String(router.query.code || "").toLowerCase();
      if (!c && user.countryId) {
        try {
          const fetched = await countryCodeById(user.countryId, token);
          if (fetched) c = String(fetched).toLowerCase();
        } catch {}
      }
      if (!cancelled) setCode(c);
    })();
    return () => { cancelled = true; };
  }, [router.query.code]);

  const gtLink = code ? `/galaxy-try/${code}` : "/galaxy-try";
  const devLink = code ? `/c/${code}/devices` : "/devices";

  return (
    <div className="grid grid-cols-2 h-screen bg-gradient-to-br from-samsung-blue to-black">
      <Link href={gtLink} className="relative block">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: "url('/Background%20galaxytry.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex h-full w-full items-center justify-center">
          <span className="text-white text-4xl md:text-5xl font-bold">
            GALAXY TRY
          </span>
        </div>
      </Link>
      <Link href={devLink} className="relative block">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: "url('/Background%20foldables.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex h-full w-full items-center justify-center">
          <span className="text-white text-4xl md:text-5xl font-bold">
            DEVICES
          </span>
        </div>
      </Link>
    </div>
  );
}

export default withAuth(DashboardPage);
