/** "2026-10-04" -> "4 Oct 2026" (date-only values; no timezone shifting). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** 1500 -> "BDT 1,500"; 1500.5 -> "BDT 1,500.50". */
export function formatBdt(amount: number): string {
  const hasFraction = Math.round(amount * 100) % 100 !== 0;
  return `BDT ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/**
 * Timestamp in Dhaka time (UTC+6, no DST): "4 Oct 2026, 15:42". Used for
 * order submission times so every admin sees the same local clock.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dhaka",
  }).format(date);
}

/** "2026-09-12" -> "September 2026" (date-only values; no timezone shifting). */
export function formatMonthYear(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  if (!y || !m) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
