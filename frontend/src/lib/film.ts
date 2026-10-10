/** The intro film, one cut per theme: plays full screen once per browser session on the landing page, then loops muted in the film section. */
export const FILM_SRC = {
  dark: "/film/omnidoc-intro-dark.mp4",
  light: "/film/omnidoc-intro-light.mp4",
} as const;
export const INTRO_SEEN_KEY = "omnidoc-intro-seen";

/**
 * Runs before first paint (see the root layout) so the landing page never
 * flashes before the intro. Sets <html data-intro="play"> only on "/" for a
 * first visit in this session without reduced motion, or with ?intro in the URL.
 */
export const INTRO_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,p=location.pathname,q=/[?&]intro\\b/.test(location.search);var seen=sessionStorage.getItem("${INTRO_SEEN_KEY}");var rm=matchMedia("(prefers-reduced-motion: reduce)").matches;d.dataset.intro=(p==="/"&&(q||(!seen&&!rm)))?"play":"skip";}catch(e){document.documentElement.dataset.intro="skip";}})();`;
