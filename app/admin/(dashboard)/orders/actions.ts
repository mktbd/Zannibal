"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { isOrderStatus } from "@/lib/orders";
import { formString, UUID_PATTERN } from "@/lib/validation";
import type { EditorState } from "@/components/admin/editor-state";

/**
 * The only Orders mutation in the CMS: change an order's status.
 *
 * - Writes the `status` column and nothing else; customer, payment and
 *   snapshot fields are historical and never sent to the database here.
 * - Conditional on the status the admin was looking at (`from`), so a
 *   double submit or a change made in another tab can't be silently
 *   overwritten.
 * - There is intentionally no delete action: orders are historical records
 *   (and RLS has no DELETE policy for orders). A bad order is marked Invalid.
 */
export async function updateOrderStatus(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const id = formString(formData, "id");
  const from = formString(formData, "from");
  const to = formString(formData, "status");
  if (!UUID_PATTERN.test(id)) {
    return { status: "error", message: "This order could not be identified. Reload and try again.", fieldErrors: {} };
  }
  if (!isOrderStatus(to) || !isOrderStatus(from)) {
    return { status: "error", message: "That status is not valid.", fieldErrors: {} };
  }
  if (to === from) {
    return { status: "error", message: "The order already has that status.", fieldErrors: {} };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: to })
    .eq("id", id)
    .eq("status", from)
    .select("id");

  if (error) {
    console.error("[admin/orders] status update failed:", error.message);
    return { status: "error", message: "The status could not be changed. Try again.", fieldErrors: {} };
  }
  if (data.length === 0) {
    // Either the order no longer exists or its status changed meanwhile.
    revalidatePath(`/admin/orders/${id}`);
    return {
      status: "error",
      message: "This order’s status was changed elsewhere, or the order no longer exists. Reload to see its current state.",
      fieldErrors: {},
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?notice=${to}`);
}
