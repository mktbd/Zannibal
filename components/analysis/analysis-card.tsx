import Link from "next/link";
import type { MouseEvent } from "react";
import { AnalysisCover } from "./analysis-cover";

/**
 * One Analysis as a cover card: its first slide uncropped in a 9:16 frame,
 * the title over a dark gradient, the whole card a link to
 * /analysis/[slug]. Shared by the homepage (Latest Analysis) and the
 * /analysis archive, which intercepts the click to open the viewer in
 * place. No date, tags or excerpt by design.
 */
export function AnalysisCard({
  analysis,
  sizes,
  preload = false,
  compact = false,
  prefetch,
  onOpen,
}: {
  analysis: { title: string; slug: string; coverUrl: string | null };
  sizes: string;
  preload?: boolean;
  /** Title sized for the archive grid (one column on phones, then 2, then 3). */
  compact?: boolean;
  /** Next's default unless set; the archive turns it off (it opens in place). */
  prefetch?: boolean;
  onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={`/analysis/${analysis.slug}`}
      prefetch={prefetch}
      onClick={onOpen}
      className="group relative block aspect-[9/16] overflow-hidden bg-near-black"
    >
      <AnalysisCover src={analysis.coverUrl} title={analysis.title} sizes={sizes} preload={preload} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
      />
      <h3
        className={`absolute inset-x-0 bottom-0 leading-tight font-bold text-balance text-white group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 ${
          compact ? "p-5 text-xl min-[600px]:p-4 min-[600px]:text-lg md:p-5 md:text-xl xl:text-[1.375rem]" : "p-5 text-xl sm:text-2xl"
        }`}
      >
        {analysis.title}
      </h3>
    </Link>
  );
}
