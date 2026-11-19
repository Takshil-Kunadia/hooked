import { StageMount } from "@/components/three/StageMount";

export default function Home() {
  return (
    <main className="relative min-h-svh overflow-x-clip">
      <StageMount />
      <section
        aria-labelledby="hero-title"
        className="relative z-10 flex min-h-svh items-end px-4 pb-[11svh] sm:px-[clamp(80px,9vw,150px)]"
      >
        <div className="max-w-[1180px]">
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
        </div>
      </section>
    </main>
  );
}
