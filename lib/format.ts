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
