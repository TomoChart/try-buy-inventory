import withAuth from '../components/withAuth';

function Dashboard() {
  return <div style={{ padding:20 }}>Dashboard – logged in ✅</div>;
}
export default withAuth(Dashboard);
