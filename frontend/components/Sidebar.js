import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <ul>
        <li><Link href="/trybuy">Try & Buy</Link></li>
        <li><Link href="/devices">Devices</Link></li>
        <li><Link href="/reports">Reports</Link></li>
        <li><Link href="/btl">BTL Inventory</Link></li>
        <li><Link href="/imports">Imports</Link></li>
        <li><Link href="/settings">Settings</Link></li>
      </ul>
    </div>
  );
}
