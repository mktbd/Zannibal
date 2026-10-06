"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Eyebrow } from "@/components/site/primitives";
import { formatBdt } from "@/lib/format";
import { ORDER_FIELD_LIMITS, ORDER_FIELDS, validateOrderField, type OrderField, type OrderFieldErrors } from "@/lib/order-input";

type Confirmation = { orderNumber: string; caseStudyTitle: string; priceBdt: number; savedAt: number };

/** A confirmation is shown again after reload/back for this long (same tab only). */
const CONFIRMATION_TTL_MS = 2 * 60 * 60 * 1000;
const STORAGE_EVENT = "mktbd:order-confirmation";
const storageKey = (slug: string) => `mktbd:order-confirmation:${slug}`;

function readStored(slug: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(slug));
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): Confirmation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Confirmation;
    if (typeof value.orderNumber !== "string" || Date.now() - value.savedAt > CONFIRMATION_TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

function writeStored(slug: string, value: Confirmation) {
  try {
    window.sessionStorage.setItem(storageKey(slug), JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => window.removeEventListener(STORAGE_EVENT, onChange);
}

const EMPTY: Record<OrderField, string> = { customerName: "", email: "", bkashNumber: "", transactionNumber: "" };

const FIELD_COPY: Record<
  OrderField,
  { label: string; hint?: string; input: React.InputHTMLAttributes<HTMLInputElement> }
> = {
  customerName: {
    label: "Full name",
    input: { type: "text", autoComplete: "name", autoCapitalize: "words" },
  },
  email: {
    label: "Email address",
    hint: "The Case Study PDF is sent here after your payment is verified.",
    input: { type: "email", autoComplete: "email", inputMode: "email", autoCapitalize: "none", spellCheck: false },
  },
  bkashNumber: {
    label: "bKash number",
    hint: "The number you sent the payment from.",
    input: { type: "tel", autoComplete: "tel-national", inputMode: "tel" },
  },
  transactionNumber: {
    label: "bKash Transaction ID",
    hint: "Shown in the bKash app and SMS after you send money.",
    input: { type: "text", autoComplete: "off", autoCapitalize: "characters", autoCorrect: "off", spellCheck: false },
  },
};

const inputClass =
  "mt-2 block min-h-12 w-full rounded-sm border border-black/25 bg-white px-3.5 text-base text-black placeholder:text-muted hover:border-black/50 focus:border-black aria-[invalid=true]:border-red-700";

/**
 * The purchase steps under the product header: bKash instructions (server
 * rendered, passed in), the customer form, and the confirmation that
 * replaces both once the order is recorded.
 *
 * - Only the slug, the price the customer was shown and the four fields are
 *   sent; the server derives everything else.
 * - Repeat submits are blocked while a request is in flight.
 * - The confirmation (order number, title, amount -- no personal details)
 *   is kept in this tab's sessionStorage, so a reload or Back/Forward shows
 *   it again instead of an empty form that invites a second submission.
 *   There is no public order lookup: nothing is fetched to show it.
 */
export function PurchaseFlow({
  slug,
  priceBdt,
  instructions,
  contactEmail,
}: {
  slug: string;
  priceBdt: number;
  instructions: React.ReactNode;
  contactEmail: string | null;
}) {
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(slug),
    () => null,
  );
  const confirmation = parseStored(stored);

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<OrderFieldErrors>({});
  const [formError, setFormError] = useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const inFlight = useRef(false);
  const fieldRefs = useRef<Partial<Record<OrderField, HTMLInputElement | null>>>({});
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const shownConfirmation = useRef<string | null>(null);

  // Move focus to the confirmation when it first appears after submitting.
  useEffect(() => {
    if (confirmation && shownConfirmation.current === "pending-focus") {
      confirmationHeading.current?.focus();
      window.scrollTo({ top: 0 });
    }
    shownConfirmation.current = confirmation?.orderNumber ?? null;
  }, [confirmation]);

  function focusFirstError(fieldErrors: OrderFieldErrors) {
    const first = ORDER_FIELDS.find((field) => fieldErrors[field]);
    if (first) fieldRefs.current[first]?.focus();
  }

  function update(field: OrderField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Once a field shows an error, re-check it as the customer corrects it.
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validateOrderField(field, value) ?? undefined }));
  }

  function check(field: OrderField) {
    if (values[field].trim() === "" && !errors[field]) return;
    setErrors((current) => ({ ...current, [field]: validateOrderField(field, values[field]) ?? undefined }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const fieldErrors: OrderFieldErrors = {};
    for (const field of ORDER_FIELDS) {
      const error = validateOrderField(field, values[field]);
      if (error) fieldErrors[field] = error;
    }
    setErrors(fieldErrors);
    setFormError(null);
    if (Object.keys(fieldErrors).length) {
      focusFirstError(fieldErrors);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, expectedPriceBdt: priceBdt, ...values }),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (response.ok && data && typeof data.orderNumber === "string") {
        shownConfirmation.current = "pending-focus";
        writeStored(slug, {
          orderNumber: data.orderNumber,
          caseStudyTitle: String(data.caseStudyTitle),
          priceBdt: Number(data.priceBdt),
          savedAt: Date.now(),
        });
        setValues(EMPTY);
        return;
      }
      const code = data?.error;
      if (code === "invalid" && data?.fieldErrors) {
        const serverErrors = data.fieldErrors as OrderFieldErrors;
        setErrors(serverErrors);
        focusFirstError(serverErrors);
      } else if (code === "duplicate_transaction") {
        const duplicate: OrderFieldErrors = {
          transactionNumber: `This Transaction ID has already been used for another order. Check it and try again${
            contactEmail ? `, or contact ${contactEmail}` : ""
          }.`,
        };
        setErrors(duplicate);
        focusFirstError(duplicate);
      } else if (code === "price_changed") {
        setFormError(
          <>
            The price of this case study has changed to {formatBdt(Number(data?.priceBdt))}.{" "}
            <button type="button" onClick={() => window.location.reload()} className="font-medium underline underline-offset-[0.2em]">
              Reload the page
            </button>{" "}
            to see the current price before you pay.
          </>,
        );
      } else if (code === "case_study_unavailable") {
        setUnavailable(true);
      } else if (code === "unavailable") {
        setFormError("Online ordering isn’t available right now. Please try again later.");
      } else {
        setFormError("Your order couldn’t be submitted. Please try again in a moment.");
      }
    } catch {
      setFormError(
        "Your details couldn’t be sent. Check your connection and submit again — sending the same details again won’t create a second order.",
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section aria-labelledby="order-received-heading">
        <div>
          <Eyebrow marker className="text-muted">
            Order Received
          </Eyebrow>
          <div className="mt-4 min-w-0">
            <h2
              id="order-received-heading"
              ref={confirmationHeading}
              tabIndex={-1}
              className="max-w-[24ch] text-[clamp(1.625rem,1.35rem+1.1vw,2.25rem)] leading-[1.1] font-extrabold tracking-[-0.015em] text-balance outline-none!"
            >
              Thank you. Your order details have been received.
            </h2>
            <dl className="mt-8 grid grid-cols-1 border-y border-black/15 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <dt className="pt-4 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:py-4">Order number</dt>
              <dd className="pt-1 pb-4 text-2xl font-semibold tracking-wide break-all tabular-nums select-all sm:py-3.5">
                {confirmation.orderNumber}
              </dd>
              <dt className="border-t border-black/10 pt-4 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:py-4">
                Case Study
              </dt>
              <dd className="pt-1 pb-4 font-medium break-words sm:border-t sm:border-black/10 sm:py-4">{confirmation.caseStudyTitle}</dd>
              <dt className="border-t border-black/10 pt-4 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:py-4">
                Amount
              </dt>
              <dd className="pt-1 pb-4 font-medium tabular-nums sm:border-t sm:border-black/10 sm:py-4">
                {formatBdt(confirmation.priceBdt)}
              </dd>
              <dt className="border-t border-black/10 pt-4 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:py-4">
                Status
              </dt>
              <dd className="pt-1 pb-4 font-medium sm:border-t sm:border-black/10 sm:py-4">Pending verification</dd>
            </dl>
            <p className="mt-6 max-w-[56ch] leading-relaxed">
              We’ve received your order details. Your payment will be manually verified before the Case Study is sent
              to your email.
            </p>
            <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-muted">
              Keep your order number for reference. Payments are not verified automatically, so this page does not
              confirm your payment.
            </p>
            <div className="mt-8">
              <Link
                href="/case-studies"
                className="group inline-flex min-h-11 items-center gap-1.5 font-medium"
              >
                <span className="underline decoration-1 underline-offset-[0.2em] group-hover:decoration-2">Browse Case Studies</span>
                <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (unavailable) {
    return (
      <section aria-labelledby="purchase-unavailable-heading">
        <div>
          <div role="alert">
            <h2 id="purchase-unavailable-heading" className="text-xl font-bold">
              This case study is no longer available.
            </h2>
            <p className="mt-3 max-w-[52ch] text-muted">
              Your order was not created. If you already sent a payment
              {contactEmail ? (
                <>
                  , contact <a href={`mailto:${contactEmail}`} className="underline underline-offset-[0.2em]">{contactEmail}</a>
                </>
              ) : (
                ", contact mktbd"
              )}
              .
            </p>
            <p className="mt-6">
              <Link href="/case-studies" className="inline-flex min-h-11 items-center font-medium underline underline-offset-[0.2em]">
                Browse Case Studies →
              </Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {instructions}
      <section aria-labelledby="your-details-heading" className="mt-12 border-t border-black/15 pt-8 sm:pt-10">
        <div>
          <h2 id="your-details-heading" className="text-xs font-semibold tracking-[0.14em] uppercase">
            <span className="mr-2 text-muted tabular-nums">2</span>Submit Your Details
          </h2>
          <form noValidate onSubmit={submit} aria-busy={submitting} className="mt-5">
            <p className="text-sm text-muted">After sending the payment, enter these details so we can match it. All fields are required.</p>
            <div className="mt-6 space-y-6">
              {ORDER_FIELDS.map((field) => {
                const copy = FIELD_COPY[field];
                const id = `order-${field}`;
                const error = errors[field];
                const describedBy = [copy.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
                return (
                  <div key={field}>
                    <label htmlFor={id} className="block text-sm font-semibold">
                      {copy.label}
                    </label>
                    {copy.hint ? (
                      <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
                        {copy.hint}
                      </p>
                    ) : null}
                    <input
                      id={id}
                      name={field}
                      ref={(node) => {
                        fieldRefs.current[field] = node;
                      }}
                      {...copy.input}
                      required
                      aria-required="true"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={describedBy || undefined}
                      maxLength={ORDER_FIELD_LIMITS[field]}
                      value={values[field]}
                      onChange={(event) => update(field, event.target.value)}
                      onBlur={() => check(field)}
                      className={`${inputClass} ${field === "transactionNumber" ? "tracking-wide" : ""}`}
                    />
                    {error ? (
                      <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-700">
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {formError ? (
              <p role="alert" className="mt-8 border-l-2 border-red-700 pl-3 text-sm font-medium text-red-700">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              aria-disabled={submitting}
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-black px-8 text-sm font-semibold tracking-[0.12em] text-white uppercase hover:bg-near-black/85 aria-disabled:cursor-progress aria-disabled:bg-near-black/70 sm:w-auto sm:min-w-64"
            >
              {submitting ? "Submitting…" : "Submit Payment Details"}
            </button>
            <p aria-live="polite" className="sr-only">
              {submitting ? "Submitting your order…" : ""}
            </p>
            <p className="mt-4 text-sm text-muted">Your payment will be manually verified before the Case Study is sent to your email.</p>
          </form>
        </div>
      </section>
    </>
  );
}
