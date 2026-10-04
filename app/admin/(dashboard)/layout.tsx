import { requireAdmin } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requireAdmin();

  return (
    <div className="admin-shell min-h-screen bg-off-white text-black lg:flex">
      <a
        href="#admin-main"
        className="sr-only z-50 bg-white px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <AdminSidebar email={user.email} />
      <main
        id="admin-main"
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
      >
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
