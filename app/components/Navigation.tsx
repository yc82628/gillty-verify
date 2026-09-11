import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="nav">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        GILL<span className="real">TY</span>
      </Link>
      <div className="nav-links">
        <Link href="/capture">Verify me</Link>
        <Link href="/verify">Check a match</Link>
        <Link href="/gate">Partner demo</Link>
      </div>
    </nav>
  );
}
