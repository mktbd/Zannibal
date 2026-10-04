export default async function CaseStudyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="page-container py-24">
      <h1 className="text-3xl font-extrabold">Case Study: {slug}</h1>
      <p className="mt-4 max-w-prose text-muted">
        Case study product page placeholder for slug &quot;{slug}&quot;. The
        product description, pricing and purchase flow will be implemented in
        a later task per docs/MKTBD_SPEC.md.
      </p>
    </div>
  );
}
