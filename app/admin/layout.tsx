import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analysis", label: "Analysis" },
  { href: "/admin/case-studies", label: "Case Studies" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/orders", label: "Orders" },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-light-grey px-4 py-6">
        <div className="mb-8 text-lg font-extrabold">mktbd admin</div>
        <nav className="flex flex-col gap-2 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
