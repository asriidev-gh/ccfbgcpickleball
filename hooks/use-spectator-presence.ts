"use client";

import { nanoid } from "nanoid";
import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 5_000;

function getOrCreateSessionId(gameId: string) {
  const storageKey = `spectator-presence-${gameId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const sessionId = nanoid();
  sessionStorage.setItem(storageKey, sessionId);
  return sessionId;
}

function sendPresence(gameId: string, sessionId: string, leave = false) {
  const payload = JSON.stringify({ sessionId, leave });
  const url = `/api/games/${gameId}/spectate/presence`;

  if (leave && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    if (sent) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: leave,
  }).catch(() => {});
}

export function useSpectatorPresence(gameId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !gameId) return;

    const sessionId = getOrCreateSessionId(gameId);
    let interval: number | null = null;
    let isPresent = false;

    const join = () => {
      if (isPresent) return;
      isPresent = true;
      sendPresence(gameId, sessionId);
    };

    const leave = () => {
      if (!isPresent) return;
      isPresent = false;
      sendPresence(gameId, sessionId, true);
    };

    const startHeartbeat = () => {
      if (interval !== null) return;
      join();
      interval = window.setInterval(() => {
        sendPresence(gameId, sessionId);
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
      leave();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    const handlePageHide = () => {
      stopHeartbeat();
    };

    if (document.visibilityState === "visible") {
      startHeartbeat();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      stopHeartbeat();
    };
  }, [enabled, gameId]);
}
