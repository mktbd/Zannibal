import { PageHeader } from "./page-header";

/**
 * Stand-in for a CMS module that exists in the information architecture
 * but is implemented in a later checkpoint. Shows no data, fake or real.
 */
export function ModulePlaceholder({
  title,
  description,
  plannedFeatures,
}: {
  title: string;
  description: string;
  plannedFeatures: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section
        aria-labelledby="module-status"
        className="mt-6 max-w-2xl border border-light-grey bg-white p-5"
      >
        <h2 id="module-status" className="text-sm font-semibold">
          Not available yet
        </h2>
        <p className="mt-1 text-sm text-muted">
          This part of the CMS is planned and will be built in an upcoming
          checkpoint. It will cover:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {plannedFeatures.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
