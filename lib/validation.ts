/**
 * Small, dependency-free parsers for CMS form fields. Each returns either
 * a value or an error message; Server Actions collect the messages into
 * per-field errors.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Trimmed single-line text with internal whitespace collapsed. */
export function cleanLine(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Trimmed multi-line text: normalised newlines, no trailing spaces. */
export function cleanMultiline(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function parseRequiredText(raw: string, label: string, max: number): Parsed<string> {
  const value = cleanLine(raw);
  if (value === "") return { ok: false, error: `Enter a ${label}.` };
  if (value.length > max) return { ok: false, error: `${capitalise(label)} can be at most ${max} characters.` };
  return { ok: true, value };
}

export function parseOptionalText(
  raw: string,
  label: string,
  max: number,
  multiline = false,
): Parsed<string | null> {
  const value = multiline ? cleanMultiline(raw) : cleanLine(raw);
  if (value === "") return { ok: true, value: null };
  if (value.length > max) return { ok: false, error: `${capitalise(label)} can be at most ${max} characters.` };
  return { ok: true, value };
}

/** YYYY-MM-DD that is a real calendar date. */
export function parseDate(raw: string): Parsed<string> {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "Choose a publication date." };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { ok: false, error: "Use a valid date." };
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { ok: false, error: "Use a valid date." };
  }
  if (y < 2000 || y > 2100) return { ok: false, error: "Use a date between 2000 and 2100." };
  return { ok: true, value };
}

/** Optional absolute http(s) URL (matches the analyses.linkedin_url check). */
export function parseOptionalUrl(raw: string, max = 500): Parsed<string | null> {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  if (value.length > max) return { ok: false, error: `URLs can be at most ${max} characters.` };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return { ok: true, value };
  } catch {
    return { ok: false, error: "Enter a full URL starting with https://." };
  }
}

/**
 * Optional BDT amount for case_studies.price_bdt (numeric(10,2), >= 0).
 * Blank means "not set" and is stored as the column default, 0.
 */
export function parsePriceBdt(raw: string): Parsed<number> {
  const value = raw.trim().replace(/,/g, "");
  if (value === "") return { ok: true, value: 0 };
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) {
    return { ok: false, error: "Enter an amount in BDT, e.g. 1500 or 1500.50 (up to 2 decimals)." };
  }
  return { ok: true, value: Number(value) };
}

/** Optional positive whole number (case_studies.page_count > 0). */
export function parseOptionalPositiveInt(raw: string, label: string, max: number): Parsed<number | null> {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    return { ok: false, error: `${capitalise(label)} must be a whole number of at least 1.` };
  }
  if (Number(value) > max) return { ok: false, error: `${capitalise(label)} can be at most ${max}.` };
  return { ok: true, value: Number(value) };
}

/** Distinct, well-formed UUIDs from repeated form fields. */
export function parseIdList(formData: FormData, name: string, max: number): Parsed<string[]> {
  const ids = [...new Set(formData.getAll(name).map(String))];
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    return { ok: false, error: "One of the selected items could not be identified. Reload and try again." };
  }
  if (ids.length > max) return { ok: false, error: `Select at most ${max}.` };
  return { ok: true, value: ids };
}

/** Today's date in Bangladesh as YYYY-MM-DD (default publication date). */
export function todayInDhaka(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
