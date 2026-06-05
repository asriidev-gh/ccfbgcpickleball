"use client";

import { useEffect } from "react";

import { migrateLegacySpectatorLocalStorage } from "@/lib/spectator-session";

/**
 * Spectator identity and notifications use sessionStorage, which the browser
 * clears automatically when the tab or browser closes. Migrates any legacy
 * localStorage player link from older builds.
 */
export function useSpectatorSessionCleanup(gameId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !gameId) return;
    migrateLegacySpectatorLocalStorage(gameId);
  }, [enabled, gameId]);
}
