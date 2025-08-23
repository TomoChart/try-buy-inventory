import { useRouter } from "next/router";
import withAuth from "../../../components/withAuth";

function CountryDashboard() {
  const router = useRouter();
  const { code } = router.query;
  return (
    <div className="p-8 text-center text-lg font-semibold">
      Dashboard — {code?.toUpperCase()}
    </div>
  );
}

export default withAuth(CountryDashboard);

