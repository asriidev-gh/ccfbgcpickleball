"use client";

import { useEffect, useState } from "react";

import type { OperatorFullPayload } from "@/lib/operator-payload";
import { readQuickGamePayload, useQuickGameSession } from "@/lib/quick-game-store";

/** Avoid hydration mismatch: browser session storage is unavailable during SSR. */
export function useQuickGameSessionAfterMount(gameId: string): OperatorFullPayload | undefined {
  const [mounted, setMounted] = useState(false);
  const sessionFromStore = useQuickGameSession(gameId);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !gameId) return undefined;
  return sessionFromStore ?? readQuickGamePayload(gameId);
}
