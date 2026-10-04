"use client";

import { useEffect } from "react";
import { buttonSecondary } from "@/components/admin/ui";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="max-w-xl border border-light-grey bg-white p-5">
      <h1 className="text-lg font-bold">This page couldn’t be loaded</h1>
      <p className="mt-1 text-sm text-muted">
        The data for this screen could not be read from the database. Nothing
        was changed. Try again, and if it keeps failing, check the Supabase
        project status.
      </p>
      <button type="button" onClick={() => retry()} className={`${buttonSecondary} mt-4`}>
        Try again
      </button>
    </div>
  );
}
