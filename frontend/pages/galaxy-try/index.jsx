import { useEffect } from "react";
import { useRouter } from "next/router";
import { getToken, parseJwt, countryCodeById } from "../../lib/auth";
import { TrashIcon } from "@heroicons/react/24/solid";

export default function GalaxyTryIndex() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let target = "hr"; // fallback
      try {
        const t = getToken();
        const u = t ? parseJwt(t) : null;
        if (u?.countryId) {
          const code = await countryCodeById(u.countryId, t);
          if (code) target = String(code).toLowerCase();
        }
      } catch { /* ignore */ }
      if (!cancelled) router.replace(`/galaxy-try/${target}`);
    })();
    return () => { cancelled = true; };
  }, [router]);

  return null;
}
