export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="page-container py-24">
      <h1 className="text-3xl font-extrabold">Analysis: {slug}</h1>
      <p className="mt-4 max-w-prose text-muted">
        Analysis viewer placeholder for slug &quot;{slug}&quot;. The carousel
        lightbox experience will be implemented in a later task per
        docs/MKTBD_SPEC.md.
      </p>
    </div>
  );
}
