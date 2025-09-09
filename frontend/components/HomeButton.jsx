import Link from 'next/link';

export default function HomeButton() {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '8px 0' }}>
      <Link href="/dashboard" legacyBehavior>
        <a
          style={{
            display: 'inline-block',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          ⬅ Home
        </a>
      </Link>
    </div>
  );
}
