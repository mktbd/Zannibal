import { getOrderableCaseStudy, createPendingOrder } from "@/lib/data/orders";
import { getBkashPaymentNumber } from "@/lib/payment";
import { MAX_ORDER_BODY_BYTES, parseOrderRequest, samePrice } from "@/lib/order-input";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: NO_STORE });

/**
 * POST /api/orders -- the site's only public write: record a manual bKash
 * payment as a Pending order.
 *
 * Accepts a small JSON body of the Case Study slug, the price the customer
 * was shown, and the four customer fields; nothing else. The server
 * re-reads the published Case Study and derives the order's title and
 * price snapshots itself; status is always Pending and the order number
 * comes from the database. The response carries only the order number,
 * the Case Study title and the amount -- never the customer's details.
 *
 * Errors are short codes (plus per-field messages for invalid input) and
 * never echo submitted values, database details or credentials. Nothing
 * submitted is logged. Only POST is exported, so every other method gets
 * 405; there is no way to read, list, update or delete orders here.
 */
export async function POST(request: Request) {
  // Same-origin only: the purchase page posts JSON with fetch. Cross-site
  // JSON requests are already stopped by CORS preflight; this refuses any
  // request that announces a different origin.
  const origin = request.headers.get("origin");
  if (origin) {
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (!host || originHost !== host) return reply(403, { error: "forbidden" });
  }

  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return reply(415, { error: "malformed" });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_ORDER_BODY_BYTES) return reply(413, { error: "malformed" });

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_ORDER_BODY_BYTES) return reply(413, { error: "malformed" });
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: "malformed" });
  }

  const parsed = parseOrderRequest(body);
  if (!parsed.ok) {
    return parsed.reason === "invalid"
      ? reply(400, { error: "invalid", fieldErrors: parsed.fieldErrors })
      : reply(400, { error: "malformed" });
  }
  const { slug, expectedPriceBdt, ...customer } = parsed.value;

  // Purchasing is paused when no receiving number is configured: never
  // record a payment the customer could not have been told how to make.
  if (!getBkashPaymentNumber()) return reply(503, { error: "unavailable" });

  try {
    const caseStudy = await getOrderableCaseStudy(slug);
    if (!caseStudy) return reply(404, { error: "case_study_unavailable" });
    if (!samePrice(caseStudy.priceBdt, expectedPriceBdt))
      return reply(409, { error: "price_changed", priceBdt: caseStudy.priceBdt });

    const result = await createPendingOrder(caseStudy, customer);
    if (!result.ok) {
      if (result.reason === "duplicate_transaction") return reply(409, { error: "duplicate_transaction" });
      if (result.reason === "unavailable") return reply(404, { error: "case_study_unavailable" });
      return reply(500, { error: "server" });
    }
    return reply(result.replayed ? 200 : 201, {
      orderNumber: result.order.orderNumber,
      caseStudyTitle: result.order.caseStudyTitle,
      priceBdt: result.order.priceBdt,
      status: "pending",
    });
  } catch (error) {
    console.error("[orders] order submission failed:", error instanceof Error ? error.message : "unknown error");
    return reply(500, { error: "server" });
  }
}
