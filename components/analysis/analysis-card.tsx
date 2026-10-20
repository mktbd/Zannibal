import Link from "next/link";
import type { MouseEvent } from "react";
import { AnalysisCover } from "./analysis-cover";

/**
 * One Analysis as a cover card: its first slide whole in a 4:5 frame (the
 * slide format, 1080x1350) with nothing laid over it, the title beneath,
 * the whole card a link to /analysis/[slug]. Shared by the homepage
 * (Latest Analysis) and the /analysis archive, which intercepts the click
 * to open the viewer in place. No date, tags or excerpt by design.
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
    <Link href={`/analysis/${analysis.slug}`} prefetch={prefetch} onClick={onOpen} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-near-black">
        <AnalysisCover src={analysis.coverUrl} title={analysis.title} sizes={sizes} preload={preload} />
      </div>
      <h3
        className={`leading-tight font-bold text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 ${
          compact ? "mt-3 text-xl min-[600px]:text-lg md:mt-4 md:text-xl xl:text-[1.375rem]" : "mt-4 text-xl sm:text-2xl"
        }`}
      >
        {analysis.title}
      </h3>
    </Link>
  );
}
