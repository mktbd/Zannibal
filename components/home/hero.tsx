import Image from "next/image";
import { Container, Highlight, TextLink } from "@/components/site/primitives";
import { HERO_IMAGE } from "@/lib/site";

/**
 * Right-hand hero visual. With an approved image (HERO_IMAGE in
 * lib/site.ts) it fills the panel and fades into the black copy side --
 * leftwards on desktop, upwards on mobile where it sits below the copy.
 * A temporary placeholder image is captioned as such; with no image at all
 * a plainly marked neutral panel holds the space.
 */
function HeroVisual() {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-near-black lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[44%]">
      {HERO_IMAGE ? (
        <Image
          src={HERO_IMAGE.src}
          alt={HERO_IMAGE.alt}
          fill
          preload
          sizes="(min-width: 1024px) 44vw, 100vw"
          className="object-cover"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_14px,rgb(255_255_255/0.035)_14px_15px)]">
          <span className="absolute right-4 bottom-4 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
            Hero image placeholder
          </span>
        </div>
      )}
      {/* Fade into the black copy side. On phones/tablets the upward fade is
          short (black -> 10% by 35% of the height), so the image reads as
          part of the hero right under "Explore Analysis" rather than
          starting after a band of black. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black via-black/10 via-35% to-transparent lg:bg-gradient-to-r lg:from-black lg:via-black/35 lg:via-50% lg:to-transparent" />
      {HERO_IMAGE?.placeholder ? (
        <span aria-hidden="true" className="absolute right-4 bottom-4 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Placeholder image
        </span>
      ) : null}
    </div>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="on-dark relative overflow-hidden bg-black text-white">
      <Container className="relative z-10 pt-14 pb-6 sm:pt-20 sm:pb-10 lg:pt-28 lg:pb-32">
        <div className="lg:max-w-[62%]">
          {/* The highlighted phrase always starts and ends its own line:
              "We Break Down How" / "Bangladeshi Businesses" / "Grow." from
              768px (sized from lg so the copy never runs under the image);
              on phones the outer lines balance and the phrase wraps, giving
              We Break / Down How / Bangladeshi / Businesses / Grow. Below lg
              the leading opens to 1.05: the two wrapped marker bands then
              clear every descender (1.01 is the minimum, see Highlight) and
              sit a consistent hairline apart, reading as two strokes. */}
          <h1
            id="hero-heading"
            className="text-display font-extrabold text-balance max-lg:leading-[1.05] lg:text-[clamp(3.25rem,4.4vw,4.125rem)] lg:text-wrap"
          >
            We Break Down How
            <br /> <Highlight>Bangladeshi Businesses</Highlight>
            <br /> Grow.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lede text-white/75 sm:mt-8">
            mktbd breaks down the strategies, decisions and market dynamics shaping businesses in Bangladesh.
          </p>
          <p className="mt-6 sm:mt-8">
            <TextLink href="/analysis" arrow className="text-white">
              Explore Analysis
            </TextLink>
          </p>
        </div>
      </Container>
      <HeroVisual />
    </section>
  );
}
