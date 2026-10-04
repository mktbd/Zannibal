import Link from "next/link";

/**
 * The small set of public editorial building blocks. Deliberately few:
 * typography, rules and black/white contrast do the work; yellow appears
 * only through <Highlight> and the eyebrow's optional marker.
 */

type Children = { children: React.ReactNode; className?: string };

/** Max-width (~1280px) content column with fluid side padding. */
export function Container({ children, className = "" }: Children) {
  return <div className={`page-container ${className}`}>{children}</div>;
}

/**
 * Small uppercase label above a heading. `marker` adds a tiny yellow square.
 * Never put the brand name in it: "mktbd" is always lowercase.
 */
export function Eyebrow({ children, className = "", marker = false }: Children & { marker?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] ${className}`}>
      {marker ? <span aria-hidden="true" className="inline-block size-2 bg-accent-yellow" /> : null}
      {children}
    </p>
  );
}

/**
 * Section heading: optional eyebrow, an h2 in the title size, and an
 * optional trailing link (e.g. "View all"), separated from the content
 * below by a thin rule.
 */
export function SectionHeading({
  title,
  eyebrow,
  action,
  id,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-current/15 pb-4">
      <div>
        {eyebrow ? <Eyebrow className="mb-2 text-muted">{eyebrow}</Eyebrow> : null}
        <h2 id={id} className="text-title font-bold">
          {title}
        </h2>
      </div>
      {action ? <div className="text-sm">{action}</div> : null}
    </div>
  );
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 text-sm font-medium transition-colors";

const buttonVariants = {
  /** Black on light surfaces. */
  primary: "bg-black text-white hover:bg-near-black/85",
  /** Thin outline on light surfaces. */
  secondary: "border border-black text-black hover:bg-black hover:text-white",
  /** White on black surfaces. */
  inverse: "bg-white text-black hover:bg-off-white",
} as const;

/** A link styled as a call to action. Navigation only -- never a <button>. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
  ...rest
}: Children & {
  href: string;
  variant?: keyof typeof buttonVariants;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Inline editorial link: underlined, with the underline thickening on hover.
 * `arrow` appends a small → that nudges right on hover (motion is disabled
 * under prefers-reduced-motion by the .site base styles).
 */
export function TextLink({
  href,
  children,
  arrow = false,
  className = "",
  ...rest
}: Children & { href: string; arrow?: boolean } & Omit<
    React.ComponentProps<typeof Link>,
    "href" | "className" | "children"
  >) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-baseline gap-1.5 font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2 ${className}`}
      {...rest}
    >
      {children}
      {arrow ? (
        <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      ) : null}
    </Link>
  );
}

/** Editorial emphasis: yellow marker behind a few important words. */
export function Highlight({ children }: { children: React.ReactNode }) {
  return <mark className="bg-accent-yellow px-[0.08em] text-black [box-decoration-break:clone]">{children}</mark>;
}
