import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-light-grey px-6 py-4">
      <Link href="/" className="text-lg font-extrabold tracking-tight">
        mktbd
      </Link>
      <nav className="flex items-center gap-6 text-sm font-medium">
        <Link href="/analysis">Analysis</Link>
        <Link href="/case-studies">Case Studies</Link>
      </nav>
    </header>
  );
}
