import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { logout } from "./actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analysis", label: "Analysis" },
  { href: "/admin/case-studies", label: "Case Studies" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/orders", label: "Orders" },
];

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-light-grey px-4 py-6">
        <div className="mb-8 text-lg font-extrabold">mktbd admin</div>
        <nav className="flex flex-1 flex-col gap-2 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-light-grey pt-4 text-sm">
          <p className="truncate text-muted">{user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-2 font-medium underline underline-offset-2"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
