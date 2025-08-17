import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <Link href="/trybuy">Try & Buy</Link>
      <Link href="/devices">Devices</Link>
      <Link href="/reports">Reports</Link>
      <Link href="/btl">BTL Inventory</Link>
      <Link href="/imports">Imports</Link>
      <Link href="/settings">Settings</Link>
    </div>
  );
}
