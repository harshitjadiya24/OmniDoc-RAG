"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { useFilmSrc } from "@/hooks/use-film-src";
import { INTRO_SEEN_KEY } from "@/lib/film";
import { duration, ease } from "@/lib/motion";
import { useFilm } from "@/stores/film";

type Phase = "boot" | "playing" | "closed";

/** Marks the page behind the film inert and unscrollable while it plays. */
function lockPage(locked: boolean) {
  const root = document.documentElement;
  root.style.overflow = locked ? "hidden" : "";
  for (const el of document.querySelectorAll<HTMLElement>("[data-site-chrome]")) el.inert = locked;
}

/**
 * Full-screen intro film. Server-rendered as a black cover so the landing page
 * never flashes first; a boot script in the root layout decides before paint
 * whether it shows. It tries to play with sound and, where the browser blocks
 * autoplay audio, plays muted with a prominent "Sound on" control.
 */
export function IntroFilm() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const skipRef = React.useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = React.useState<Phase>("boot");
  const [muted, setMuted] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const requested = useFilm((s) => s.requested);
  const src = useFilmSrc();

  const finish = React.useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      /* storage blocked: the intro may show again next visit */
    }
    videoRef.current?.pause();
    lockPage(false);
    setPhase("closed");
  }, []);

  const open = React.useCallback(() => {
    document.documentElement.dataset.intro = "play";
    lockPage(true);
    setProgress(0);
    setMuted(false);
    setPhase("playing");
  }, []);

  // Decide after the first frame: the boot script has already set data-intro before paint.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => (document.documentElement.dataset.intro === "play" ? open() : setPhase("closed")));
    return () => cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    if (requested === 0) return;
    const id = requestAnimationFrame(open);
    return () => cancelAnimationFrame(id);
  }, [requested, open]);

  // Start playback once the overlay is mounted and the theme's cut is known.
  React.useEffect(() => {
    const video = videoRef.current;
    if (phase !== "playing" || !video || !src) return;
    video.currentTime = 0;
    video.muted = false;
    video.play().catch(() => {
      // Autoplay with sound was refused: play muted and offer sound instead.
      video.muted = true;
      setMuted(true);
      video.play().catch(finish);
    });
  }, [phase, src, finish]);

  React.useEffect(() => {
    if (phase !== "playing") return;
    skipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (video.paused) void video.play().catch(() => undefined);
  };

  return (
    <AnimatePresence onExitComplete={() => (document.documentElement.dataset.intro = "skip")}>
      {phase !== "closed" && (
        <motion.div
          id="intro-film"
          key="intro"
          role="dialog"
          aria-modal="true"
          aria-label="OmniDoc intro film"
          data-lenis-prevent
          initial={false}
          exit={{ opacity: 0, transition: { duration: duration.cinematic, ease: ease.inOut } }}
          className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
        >
          <video
            ref={videoRef}
            src={src}
            playsInline
            preload="auto"
            onEnded={finish}
            onError={finish}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            className="absolute inset-0 h-full w-full object-contain"
            aria-hidden
          />
          {phase === "boot" && (
            <div aria-hidden className="absolute inset-0 grid place-items-center">
              <LogoMark className="size-10 animate-pulse motion-reduce:animate-none" />
            </div>
          )}

          <div className="relative mt-auto bg-gradient-to-t from-black/80 to-transparent px-[clamp(1rem,3vw,2.5rem)] pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div aria-hidden className="mb-4 h-0.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full origin-left bg-[#3ddc97] transition-transform duration-300 ease-linear" style={{ transform: `scaleX(${progress})` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 flex items-center gap-2 font-mono text-xs tracking-wide text-white/70 uppercase">
                <LogoMark className="size-5" /> OmniDoc · intro film
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={!muted}
                  className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${muted ? "border-[#3ddc97]/70 bg-[#3ddc97]/15 text-white" : "border-white/25 bg-white/5 text-white/85 hover:bg-white/10"}`}
                >
                  {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
                  {muted ? "Sound on" : "Mute"}
                </button>
                <button
                  ref={skipRef}
                  type="button"
                  onClick={finish}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Skip intro <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
