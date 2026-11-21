import Link from "next/link";
import { Story } from "@/components/story/Story";
import { CHAPTER_1_COPY } from "@/content/chapter-1/copy";
import { CHAPTER_1, HERO_ACT_ID } from "@/content/chapter-1/spec";
import { getStoryData } from "@/lib/story/data";
import explainers from "../../content/explainers.json";

/**
 * The page is Chapter 1. Its hero is the chapter's first act: the `<h1>` stays the first thing
 * painted (the LCP element), and Story renders the stage and every act after it. The hero lets
 * clicks through to the 3D scene; only its text takes them.
 */
export default async function Home() {
  const data = await getStoryData();
  return (
    <main className="relative min-h-svh overflow-x-clip">
      <section
        id={HERO_ACT_ID}
        aria-labelledby="hero-title"
        className="pointer-events-none relative z-10 flex min-h-svh items-end px-4 pb-[11svh] sm:px-[clamp(80px,9vw,150px)]"
      >
        <div className="pointer-events-auto max-w-[1180px]">
          <p className="font-hud mb-5 text-xs tracking-[0.08em] text-muted uppercase">
            Chapter 1 · The journey of a request
          </p>
          <h1
            id="hero-title"
            className="text-[clamp(38px,6.2vw,98px)] leading-[0.98] font-bold tracking-[-0.038em] text-text"
          >
            What happens when you visit a <em className="hero-accent font-serif font-normal italic">WordPress</em> site?
          </h1>
          <p className="mt-6 max-w-[38ch] text-[clamp(19px,1.6vw,25px)] leading-snug font-medium tracking-[-0.012em] text-text-2">
            Every page visit is a trip. Ride along with one request as it travels through WordPress, stop by stop, and
            comes back as a web page.
          </p>
          <p className="mt-6">
            <Link
              href="/map"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent"
            >
              See every hook on the map <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>
      <Story spec={CHAPTER_1} copy={CHAPTER_1_COPY} data={data} explainers={explainers} />
    </main>
  );
}
