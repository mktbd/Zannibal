/**
 * Customer input for the manual bKash purchase flow (Stage 4E): field
 * limits, normalisation and validation shared by the purchase form (for
 * inline errors) and POST /api/orders (the authority). Framework-free and
 * import-free, so it runs in the browser, on the server and in node:test.
 *
 * Only the four customer fields and the Case Study slug ever come from the
 * browser. Title, price, status and order number are always derived on the
 * server; `expectedPriceBdt` is only compared against the trusted price so a
 * customer is never asked to pay one amount while the order records another.
 */

export const ORDER_FIELD_LIMITS = {
  customerName: 120,
  email: 254,
  bkashNumber: 32,
  transactionNumber: 40,
} as const;

/** Upper bound for the whole JSON request body, in bytes. */
export const MAX_ORDER_BODY_BYTES = 4096;

export type OrderField = keyof typeof ORDER_FIELD_LIMITS;

export interface OrderCustomerInput {
  customerName: string;
  email: string;
  bkashNumber: string;
  transactionNumber: string;
}

export type OrderFieldErrors = Partial<Record<OrderField, string>>;

export interface OrderRequest extends OrderCustomerInput {
  slug: string;
  expectedPriceBdt: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bangla digits -> ASCII digits (customers may type either). */
function asciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}

export function parseCustomerName(raw: string): Result<string> {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value === "") return { ok: false, error: "Enter your name." };
  if (value.length > ORDER_FIELD_LIMITS.customerName)
    return { ok: false, error: `Your name can be at most ${ORDER_FIELD_LIMITS.customerName} characters.` };
  // At least two letters (any script): rejects "-", "..." or "1".
  if ((value.match(/\p{L}/gu) ?? []).length < 2) return { ok: false, error: "Enter your name as it should appear on the order." };
  return { ok: true, value };
}

/**
 * A plain, reasonable address check (one "@", a dotted domain, a TLD of at
 * least two letters, no spaces). Stricter than the database constraint,
 * never looser. Whether the address receives mail is not something a form
 * can prove.
 */
export function parseEmail(raw: string): Result<string> {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "Enter your email address." };
  if (value.length > ORDER_FIELD_LIMITS.email) return { ok: false, error: "This email address is too long." };
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(value))
    return { ok: false, error: "Enter a valid email address, like name@example.com." };
  return { ok: true, value };
}

/**
 * Bangladesh mobile number as customers usually write it: "01712345678",
 * "01712-345678", "+880 1712 345678", "8801712345678", Bangla digits.
 * Spaces, hyphens, dots and brackets are ignored; the result is the 11-digit
 * local form "01XXXXXXXXX" with a valid operator prefix (013-019). This
 * does not (and cannot) prove the number has a bKash account.
 */
export function parseBkashNumber(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "Enter the bKash number you paid from." };
  if (trimmed.length > ORDER_FIELD_LIMITS.bkashNumber) return { ok: false, error: "Enter an 11-digit mobile number, like 01712345678." };
  let digits = asciiDigits(trimmed).replace(/[\s\-.()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("880")) digits = digits.slice(2);
  if (!/^01[3-9]\d{8}$/.test(digits)) return { ok: false, error: "Enter an 11-digit mobile number, like 01712345678." };
  return { ok: true, value: digits };
}

/**
 * The bKash Transaction ID, normalised: trimmed, Bangla digits as ASCII,
 * letters upper-case (bKash shows IDs in capitals; Stage 5E-A). Letters and
 * digits only (6-30), as shown in the bKash app and confirmation SMS. The
 * database's unique index compares IDs the same way (trimmed, upper-case),
 * so "9f6a2b7c1d" and " 9F6A2B7C1D " are one Transaction ID. This only
 * records what the customer submitted -- it does not check that the
 * transaction exists.
 */
export function parseTransactionNumber(raw: string): Result<string> {
  const value = asciiDigits(raw.trim());
  if (value === "") return { ok: false, error: "Enter the bKash Transaction ID." };
  // Checked before upper-casing, so only ASCII letters qualify ("ﬁ" would
  // otherwise upper-case to "FI").
  if (value.length > ORDER_FIELD_LIMITS.transactionNumber || !/^[A-Za-z0-9]{6,30}$/.test(value))
    return { ok: false, error: "Enter the Transaction ID exactly as shown by bKash (letters and numbers only)." };
  return { ok: true, value: value.toUpperCase() };
}

const PARSERS: Record<OrderField, (raw: string) => Result<string>> = {
  customerName: parseCustomerName,
  email: parseEmail,
  bkashNumber: parseBkashNumber,
  transactionNumber: parseTransactionNumber,
};

export const ORDER_FIELDS = Object.keys(PARSERS) as OrderField[];

export function validateOrderField(field: OrderField, raw: string): string | null {
  const result = PARSERS[field](raw);
  return result.ok ? null : result.error;
}

/** Validates and normalises the four customer fields. */
export function parseCustomerInput(
  raw: Record<OrderField, string>,
): { ok: true; value: OrderCustomerInput } | { ok: false; fieldErrors: OrderFieldErrors } {
  const value = {} as OrderCustomerInput;
  const fieldErrors: OrderFieldErrors = {};
  for (const field of ORDER_FIELDS) {
    const result = PARSERS[field](raw[field]);
    if (result.ok) value[field] = result.value;
    else fieldErrors[field] = result.error;
  }
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, value };
}

const REQUEST_KEYS = new Set(["slug", "expectedPriceBdt", ...ORDER_FIELDS]);

/**
 * The whole POST /api/orders body. Malformed shapes (not an object,
 * unexpected or missing keys, wrong types, over-long strings) are rejected
 * outright; well-formed but invalid customer values come back as
 * per-field messages for the form.
 */
export function parseOrderRequest(
  body: unknown,
):
  | { ok: true; value: OrderRequest }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "invalid"; fieldErrors: OrderFieldErrors } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, reason: "malformed" };
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== REQUEST_KEYS.size || keys.some((key) => !REQUEST_KEYS.has(key))) return { ok: false, reason: "malformed" };
  const { slug, expectedPriceBdt } = record;
  if (typeof slug !== "string" || slug.length > 200) return { ok: false, reason: "malformed" };
  if (typeof expectedPriceBdt !== "number" || !Number.isFinite(expectedPriceBdt) || expectedPriceBdt < 0)
    return { ok: false, reason: "malformed" };
  const raw = {} as Record<OrderField, string>;
  for (const field of ORDER_FIELDS) {
    const value = record[field];
    // Generous ceiling for raw input; the parsers apply the real limits.
    if (typeof value !== "string" || value.length > ORDER_FIELD_LIMITS[field] * 2) return { ok: false, reason: "malformed" };
    raw[field] = value;
  }
  const customer = parseCustomerInput(raw);
  if (!customer.ok) return { ok: false, reason: "invalid", fieldErrors: customer.fieldErrors };
  return { ok: true, value: { slug, expectedPriceBdt, ...customer.value } };
}

/** Same money, compared in whole poisha (numeric(10,2) prices). */
export function samePrice(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

/** "01712345678" -> "01712 345678" for display (the common local grouping). */
export function formatMobileNumber(number: string): string {
  return /^01\d{9}$/.test(number) ? `${number.slice(0, 5)} ${number.slice(5)}` : number;
}
