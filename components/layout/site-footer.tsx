import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-light-grey px-6 py-6 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-6">
        <span className="font-medium text-black">mktbd</span>
        <Link href="/analysis">Analysis</Link>
        <Link href="/case-studies">Case Studies</Link>
        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </div>
      <p className="mt-4">&copy; {year} mktbd. All rights reserved.</p>
    </footer>
  );
}
