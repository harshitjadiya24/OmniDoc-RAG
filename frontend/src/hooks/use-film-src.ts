"use client";

import { useTheme } from "next-themes";
import { FILM_SRC } from "@/lib/film";
import { useMounted } from "./use-mounted";

/** The film cut for the current theme. Undefined until mounted, since the server cannot know the theme. */
export function useFilmSrc(): string | undefined {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  if (!mounted) return undefined;
  return resolvedTheme === "light" ? FILM_SRC.light : FILM_SRC.dark;
}
