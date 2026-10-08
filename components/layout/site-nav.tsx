"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "@/lib/site";

/**
 * The two primary destinations. Both fit beside the wordmark even at
 * 375px, so there is no collapsed menu. The current section is marked with
 * aria-current and a thin yellow underline -- the header's only accent.
 * `markCurrent={false}` (the site-wide 404) marks nothing: an unknown URL
 * such as /case-studies/x/y belongs to no section, even if it starts like one.
 */
export function SiteNav({ markCurrent = true }: { markCurrent?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary">
      <ul className="-mr-2 flex items-center gap-1 sm:gap-4">
        {PRIMARY_NAV.map((item) => {
          const current = markCurrent && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center px-2 text-sm font-medium transition-colors sm:text-[0.9375rem] ${
                  current ? "text-white" : "text-white/70 hover:text-white"
                }`}
              >
                {item.label}
                {current ? (
                  <span aria-hidden="true" className="absolute inset-x-2 bottom-2 h-0.5 bg-accent-yellow" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
