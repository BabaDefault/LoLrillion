"use client";

import { useEffect } from "react";

/**
 * Sinks the backdrop (scene.tsx) to `depth` scored Prompts, 0-7, by setting --dive on the root
 * element while the calling screen is shown. Leaving the screen brings the world back to the surface.
 */
export function useDive(depth: number) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--dive", String(depth));
    return () => {
      root.style.removeProperty("--dive");
    };
  }, [depth]);
}
