import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listOrders, ORDER_LIST_LIMIT } from "@/lib/data/admin/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, parseOrderStatusFilter } from "@/lib/orders";
import { formatBdt, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { ListFilters } from "@/components/admin/list-filters";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";

export const metadata = { title: "Orders · mktbd admin" };

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 200);
  const status = parseOrderStatusFilter(params.status);
  const { orders, truncated } = await listOrders({ query, status });
  const filtered = query !== "" || status !== "all";

  return (
    <>
      <PageHeader
        title="Orders"
        description="Review Case Study purchase submissions and track manual fulfilment. Times are Dhaka time."
      />

      <div className="mt-6">
        <ListFilters
          basePath="/admin/orders"
          query={query}
          status={status}
          label="Orders"
          searchLabel="Search order number, name, email or transaction"
          statusOptions={STATUS_OPTIONS}
        />
      </div>

      <section aria-labelledby="orders-list-heading" className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="orders-list-heading" className="text-sm font-semibold">
            {filtered ? "Matching orders" : "All orders"}
          </h2>
          <p className="text-xs text-muted">
            {orders.length} shown{truncated ? ` (newest ${ORDER_LIST_LIMIT}; search to find older orders)` : ""}
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="border border-dashed border-light-grey bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium">{filtered ? "No orders match these filters" : "No orders yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {filtered
                ? "Change the search or status filter."
                : "Orders appear here when customers submit a Case Study purchase."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-light-grey border border-light-grey bg-white">
            {orders.map((order) => (
              <li
                key={order.id}
                className={`grid gap-x-6 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] ${
                  order.status === "pending" ? "border-l-2 border-l-black" : "border-l-2 border-l-transparent"
                }`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="rounded-sm font-semibold tabular-nums underline-offset-4 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <OrderStatusBadge status={order.status} />
                  </p>
                  <p className="mt-1 truncate text-sm" title={order.caseStudyTitleSnapshot}>
                    {order.caseStudyTitleSnapshot}
                  </p>
                  <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
                    {order.customerName} · {order.customerEmail}
                    <span className="hidden lg:inline"> · Tx {order.bkashTransactionNumber}</span>
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-4 text-sm md:flex-col md:items-end md:justify-start md:gap-0.5">
                  <span className="font-semibold tabular-nums">{formatBdt(order.priceBdtSnapshot)}</span>
                  <span className="text-xs text-muted tabular-nums">{formatDateTime(order.submittedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
