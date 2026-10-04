"use client";

import { useActionState } from "react";
import { ORDER_STATUSES, ORDER_STATUS_DESCRIPTIONS, ORDER_STATUS_LABELS } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types/content";
import { FormError } from "@/components/admin/editor-parts";
import { initialEditorState } from "@/components/admin/editor-state";
import { buttonPrimary, buttonSecondary } from "@/components/admin/ui";
import { updateOrderStatus } from "./actions";

/**
 * One explicit button per possible next status. The form only carries the
 * order id, the status the admin is looking at, and the chosen status --
 * customer and snapshot fields are never part of this mutation.
 */
export function StatusControl({ orderId, orderNumber, status }: { orderId: string; orderNumber: string; status: OrderStatus }) {
  const [state, formAction, pending] = useActionState(updateOrderStatus, initialEditorState);
  const targets = ORDER_STATUSES.filter((s) => s !== status);

  return (
    <form action={formAction} aria-labelledby="status-heading">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="from" value={status} />
      <FormError state={state} />
      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((target) => (
          <button
            key={target}
            type="submit"
            name="status"
            value={target}
            disabled={pending}
            aria-label={`Mark order ${orderNumber} as ${ORDER_STATUS_LABELS[target]}`}
            className={`${target === "fulfilled" && status === "pending" ? buttonPrimary : buttonSecondary} min-h-10`}
          >
            {pending ? "Updating…" : `Mark as ${ORDER_STATUS_LABELS[target]}`}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-0.5 text-xs text-muted">
        {targets.map((target) => (
          <li key={target}>
            <span className="font-medium text-black">{ORDER_STATUS_LABELS[target]}:</span> {ORDER_STATUS_DESCRIPTIONS[target]}
          </li>
        ))}
      </ul>
    </form>
  );
}
