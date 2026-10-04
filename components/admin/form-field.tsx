/**
 * Label + control + hint/error wrapper for CMS forms. The control itself
 * is passed as children and should set aria-describedby={`${id}-message`}
 * and aria-invalid when `error` is present.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  publishRequired = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Needed for every save. */
  required?: boolean;
  /** Optional for drafts, needed to publish. */
  publishRequired?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium">
        {label}
        {required ? <span className="text-xs font-normal text-muted">Required</span> : null}
        {publishRequired ? (
          <span className="text-xs font-normal text-muted">Required to publish</span>
        ) : null}
      </label>
      {children}
      <p
        id={`${id}-message`}
        className={error ? "text-sm text-red-700" : hint ? "text-xs text-muted" : "sr-only"}
      >
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}

export function fieldA11y(id: string, error?: string) {
  return {
    id,
    "aria-describedby": `${id}-message`,
    "aria-invalid": error ? true : undefined,
  } as const;
}
