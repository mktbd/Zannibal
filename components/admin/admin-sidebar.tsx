"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/admin/(dashboard)/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", available: true },
  { href: "/admin/analysis", label: "Analysis", available: false },
  { href: "/admin/case-studies", label: "Case Studies", available: false },
  { href: "/admin/tags", label: "Tags", available: true },
  { href: "/admin/orders", label: "Orders", available: false },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin navigation: a persistent left sidebar from the lg breakpoint up,
 * a top bar with a disclosure menu below it. Rendering only -- access is
 * enforced by requireAdmin() on the server, never by what this shows.
 */
export function AdminSidebar({ email }: { email: string | undefined }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="admin-sidebar bg-black text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col">
      <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:pb-8 lg:pt-6">
        <Link
          href="/admin"
          className="rounded-sm text-lg font-extrabold tracking-tight"
          onClick={() => setMenuOpen(false)}
        >
          mktbd
          <span className="ml-2 text-xs font-medium tracking-normal text-white/60">
            admin
          </span>
        </Link>
        <button
          type="button"
          className="rounded-sm border border-white/30 px-3 py-1 text-sm font-medium lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="admin-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div
        id="admin-navigation"
        className={`${menuOpen ? "flex" : "hidden"} flex-col border-t border-white/15 lg:flex lg:flex-1 lg:border-t-0`}
      >
        <nav aria-label="Admin" className="flex-1 px-2 py-3 lg:px-3 lg:py-0">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center justify-between rounded-sm border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-accent-yellow bg-white/10 text-white"
                        : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {item.available ? null : (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                        Soon
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/15 px-5 py-4 text-sm">
          <p className="text-xs text-white/50">Signed in as</p>
          <p className="truncate text-white/80" title={email}>
            {email}
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-2 rounded-sm font-medium text-white underline underline-offset-4 hover:text-white/80"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
