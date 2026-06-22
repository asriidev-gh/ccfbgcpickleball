"use client";

import { useEffect, useMemo, useState } from "react";

import { listActiveEphemeralGameCards } from "@/lib/ephemeral-game-list";
import { useEphemeralQuickGameStore } from "@/store/ephemeral-quick-game-store";

export function useActiveEphemeralSessions() {
  const [clientReady, setClientReady] = useState(false);
  const sessions = useEphemeralQuickGameStore((state) => state.sessions);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const activeSessions = useMemo(() => {
    if (!clientReady) return [];
    return listActiveEphemeralGameCards(sessions);
  }, [clientReady, sessions]);

  return {
    clientReady,
    activeSessions,
    hasActiveSession: activeSessions.length > 0,
  };
}
