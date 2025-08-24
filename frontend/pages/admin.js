import withAuth from "../components/withAuth";

function AdminPage() {
	return <div>Admin panel</div>;
}

export default withAuth(AdminPage, { roles: ["SUPERADMIN"] });
