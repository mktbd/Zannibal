import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getOrder } from "@/lib/data/admin/orders";
import { ORDER_STATUS_DESCRIPTIONS, ORDER_STATUS_LABELS, isOrderStatus } from "@/lib/orders";
import { formatBdt, formatDateTime } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { SaveNotice } from "@/components/admin/editor-parts";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { linkButton } from "@/components/admin/ui";
import { StatusControl } from "../status-control";

export const metadata = { title: "Order · mktbd admin" };

function Field({ label, children, copyable = false }: { label: string; children: React.ReactNode; copyable?: boolean }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted sm:pt-0.5">{label}</dt>
      <dd className={`text-sm [overflow-wrap:anywhere] ${copyable ? "select-all font-medium tabular-nums" : ""}`}>{children}</dd>
    </div>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border border-light-grey bg-white px-5 py-4">
      <h2 id={id} className="text-sm font-semibold">
        {title}
      </h2>
      <dl className="mt-1 divide-y divide-light-grey">{children}</dl>
    </section>
  );
}

/**
 * Read-only order record plus the status control. Customer, payment and
 * snapshot fields are shown as submitted; nothing on this page edits them,
 * and there is no delete.
 */
export default async function AdminOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [order, query] = await Promise.all([getOrder(id), searchParams]);
  if (!order) notFound();

  const notice = isOrderStatus(query.notice) ? `Status changed to ${ORDER_STATUS_LABELS[query.notice]}.` : null;

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description="Verify the bKash payment, send the PDF manually, then record the outcome."
        actions={
          <Link href="/admin/orders" className={linkButton}>
            Back to Orders
          </Link>
        }
      />
      <SaveNotice notice={notice} problem={null} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <Group id="order-heading" title="Order">
            <Field label="Order number" copyable>
              {order.orderNumber}
            </Field>
            <Field label="Submitted">{formatDateTime(order.submittedAt)} (Dhaka)</Field>
            <Field label="Status">
              <OrderStatusBadge status={order.status} />
            </Field>
          </Group>

          <Group id="customer-heading" title="Customer">
            <Field label="Name">{order.customerName}</Field>
            <Field label="Email" copyable>
              {order.customerEmail}
            </Field>
            <Field label="bKash number" copyable>
              {order.bkashNumber}
            </Field>
            <Field label="Transaction number" copyable>
              {order.bkashTransactionNumber}
            </Field>
          </Group>

          <Group id="purchase-heading" title="Purchase">
            <Field label="Case Study">{order.caseStudyTitleSnapshot}</Field>
            <Field label="Price paid">
              <span className="font-semibold tabular-nums">{formatBdt(order.priceBdtSnapshot)}</span>
            </Field>
            <Field label="Case Study record">
              {order.caseStudy ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/admin/case-studies/${order.caseStudy.id}/edit`} className="font-medium underline underline-offset-4">
                    View Case Study
                  </Link>
                  <StatusBadge status={order.caseStudy.status} />
                  {order.caseStudy.title !== order.caseStudyTitleSnapshot ? (
                    <span className="text-xs text-muted">Now titled “{order.caseStudy.title}”</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted">
                  The original Case Study is no longer available. The title and price above are as purchased.
                </span>
              )}
            </Field>
          </Group>
          <p className="text-xs text-muted">
            Customer and purchase details are kept exactly as submitted and can’t be edited. Orders can’t be deleted;
            mark a bad order Invalid instead.
          </p>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <section className="border border-light-grey bg-white p-4">
            <h2 id="status-heading" className="text-sm font-semibold">
              Status
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <OrderStatusBadge status={order.status} />
            </p>
            <p className="mt-1 text-xs text-muted">{ORDER_STATUS_DESCRIPTIONS[order.status]}</p>
            <p className="mt-1 text-xs text-muted">Last changed {formatDateTime(order.updatedAt)}</p>
            <StatusControl orderId={order.id} orderNumber={order.orderNumber} status={order.status} />
          </section>
        </aside>
      </div>
    </>
  );
}
