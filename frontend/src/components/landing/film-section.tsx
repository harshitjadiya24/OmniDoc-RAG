"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play, Volume2 } from "lucide-react";
import { useFilmSrc } from "@/hooks/use-film-src";
import { useFilm } from "@/stores/film";
import { Reveal } from "./reveal";

/**
 * The intro film, looping muted on the landing page. It plays only while on
 * screen, never under reduced motion unless asked, and always has a pause
 * control (moving content longer than five seconds must be pausable).
 */
export function FilmSection() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const request = useFilm((s) => s.request);
  const src = useFilmSrc();
  const [paused, setPaused] = React.useState(true);
  const [userPaused, setUserPaused] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // A load error can fire before hydration attaches onError, so check once on mount too.
  React.useEffect(() => {
    const video = videoRef.current;
    if (video && (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) {
      const id = requestAnimationFrame(() => setFailed(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || reduced || userPaused) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && document.documentElement.dataset.intro !== "play") void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [src, reduced, userPaused]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      void video.play().catch(() => undefined);
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  if (failed) return null;

  return (
    <section aria-labelledby="film-title" className="relative overflow-x-clip border-t border-line">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,var(--glow),transparent_70%)] opacity-60" />
      <div className="relative mx-auto max-w-[1280px] px-[clamp(1rem,3vw,2.5rem)] py-[clamp(3rem,7vw,6rem)]">
        <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="eyebrow m-0">The film</p>
            <h2 id="film-title" className="m-0 font-display text-[clamp(2rem,1.3rem+2.6vw,3.25rem)] leading-none font-normal">
              From upload <em className="text-verified-text">to proof.</em>
            </h2>
          </div>
          <button
            type="button"
            onClick={request}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm text-ink transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Volume2 aria-hidden className="size-4 text-verified-text" /> Watch with sound
          </button>
        </Reveal>
        <Reveal delay={0.08}>
          <figure className="group relative m-0 overflow-hidden rounded-2xl border border-line-strong bg-black shadow-panel">
            <video
              ref={videoRef}
              src={src}
              muted
              loop
              playsInline
              preload="metadata"
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onError={() => setFailed(true)}
              className="block aspect-video w-full object-cover"
              aria-label="OmniDoc intro film, playing without sound"
            />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12">
              <span className="font-mono text-[11px] tracking-wide text-white/75 uppercase">Product film · muted loop</span>
              <button
                type="button"
                onClick={toggle}
                aria-label={paused ? "Play film" : "Pause film"}
                className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
              </button>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
