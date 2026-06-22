"use client";

import { useEffect, useState } from "react";

import type { OperatorFullPayload } from "@/lib/operator-payload";
import { readQuickGamePayload, useQuickGameSession } from "@/lib/quick-game-store";

type QuickGameSessionAfterMount = {
  payload: OperatorFullPayload | undefined;
  mounted: boolean;
};

/** Avoid hydration mismatch: browser session storage is unavailable during SSR. */
export function useQuickGameSessionAfterMount(gameId: string): QuickGameSessionAfterMount {
  const [mounted, setMounted] = useState(false);
  const sessionFromStore = useQuickGameSession(gameId);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !gameId) {
    return { payload: undefined, mounted };
  }

  return {
    payload: sessionFromStore ?? readQuickGamePayload(gameId),
    mounted: true,
  };
}
