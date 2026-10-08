import { serializeJsonLd } from "@/lib/seo";

/**
 * Server-rendered schema.org JSON-LD. Built from CMS values, so it is
 * serialised with "<" escaped (lib/seo.ts serializeJsonLd) -- a title can
 * never close the script element.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
