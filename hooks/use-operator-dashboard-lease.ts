"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_INTERVAL_MS = 15_000;
const BLOCKED_RETRY_INTERVAL_MS = 15_000;

type LeaseState =
  | { status: "loading" }
  | { status: "active" }
  | { status: "unauthorized" }
  | {
      status: "blocked";
      deviceHint?: string;
      lastSeenAt?: string;
      takenOver?: boolean;
    };

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const loginUrl = new URL("/login", window.location.origin);
  if (returnTo && returnTo !== "/login") {
    loginUrl.searchParams.set("returnTo", returnTo);
  }
  window.location.assign(loginUrl.toString());
}

function storageKey(gameId: string) {
  return `ccf-operator-dashboard-lease-${gameId}`;
}

function getOrCreateLeaseId(gameId: string) {
  const key = storageKey(gameId);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;

  const leaseId = nanoid();
  sessionStorage.setItem(key, leaseId);
  return leaseId;
}

function getStoredLeaseId(gameId: string) {
  return sessionStorage.getItem(storageKey(gameId));
}

async function postLease(
  gameId: string,
  leaseId: string,
  action: "acquire" | "renew" | "takeover" | "check",
) {
  const response = await fetch(`/api/games/${gameId}/operator-lease`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leaseId, action }),
  });
  const payload = await response.json();
  return { response, payload };
}

function releaseLease(gameId: string, leaseId: string) {
  const url = `/api/games/${gameId}/operator-lease`;
  const payload = JSON.stringify({ leaseId, action: "release" });

  if (typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    if (sent) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function readBlockedPayload(payload: unknown) {
  const data = payload as {
    deviceHint?: string;
    lastSeenAt?: string;
    takenOver?: boolean;
  };
  return {
    deviceHint: typeof data.deviceHint === "string" ? data.deviceHint : undefined,
    lastSeenAt: typeof data.lastSeenAt === "string" ? data.lastSeenAt : undefined,
    takenOver: data.takenOver === true,
  };
}

export function useOperatorDashboardLease(gameId: string, enabled: boolean) {
  const [state, setState] = useState<LeaseState>(() =>
    enabled ? { status: "loading" } : { status: "active" },
  );
  const leaseIdRef = useRef<string | null>(null);
  const hasLeaseRef = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);
  const blockedRetryTimerRef = useRef<number | null>(null);
  const renewLeaseRef = useRef<() => Promise<void>>(async () => {});
  const tryAcquireRef = useRef<(action?: "acquire" | "takeover") => Promise<void>>(async () => {});

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const stopBlockedRetry = useCallback(() => {
    if (blockedRetryTimerRef.current !== null) {
      window.clearInterval(blockedRetryTimerRef.current);
      blockedRetryTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) return;
    heartbeatTimerRef.current = window.setInterval(() => {
      void renewLeaseRef.current();
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const startBlockedRetry = useCallback(() => {
    if (blockedRetryTimerRef.current !== null) return;
    blockedRetryTimerRef.current = window.setInterval(() => {
      void tryAcquireRef.current("acquire");
    }, BLOCKED_RETRY_INTERVAL_MS);
  }, []);

  const markBlocked = useCallback(
    (payload: unknown) => {
      const blocked = readBlockedPayload(payload);
      hasLeaseRef.current = false;
      stopHeartbeat();
      setState({
        status: "blocked",
        ...blocked,
      });
    },
    [stopHeartbeat],
  );

  const tryAcquire = useCallback(
    async (action: "acquire" | "takeover" = "acquire") => {
      if (!gameId) return;
      const leaseId = leaseIdRef.current ?? getOrCreateLeaseId(gameId);
      leaseIdRef.current = leaseId;

      const { response, payload } = await postLease(gameId, leaseId, action);
      if (response.ok && payload.status === "active") {
        hasLeaseRef.current = true;
        stopBlockedRetry();
        startHeartbeat();
        setState({ status: "active" });
        return;
      }

      if (response.status === 401) {
        hasLeaseRef.current = false;
        stopHeartbeat();
        stopBlockedRetry();
        setState({ status: "unauthorized" });
        redirectToLogin();
        return;
      }

      if (response.status === 409 || payload.status === "blocked") {
        markBlocked(payload);
        startBlockedRetry();
        return;
      }

      if (response.status >= 500) {
        setState({ status: "loading" });
        startBlockedRetry();
        return;
      }

      markBlocked({
        deviceHint: "Could not open dashboard.",
      });
      startBlockedRetry();
    },
    [gameId, markBlocked, startBlockedRetry, startHeartbeat, stopBlockedRetry, stopHeartbeat],
  );
  tryAcquireRef.current = tryAcquire;

  const renewLease = useCallback(async () => {
    if (!gameId || !leaseIdRef.current || !hasLeaseRef.current) return;

    const { response, payload } = await postLease(gameId, leaseIdRef.current, "renew");
    if (response.ok && payload.status === "active") return;

    if (response.status === 401) {
      hasLeaseRef.current = false;
      stopHeartbeat();
      stopBlockedRetry();
      setState({ status: "unauthorized" });
      redirectToLogin();
      return;
    }

    if (response.status === 409 || payload.status === "blocked") {
      markBlocked(payload);
      startBlockedRetry();
    }
  }, [gameId, markBlocked, startBlockedRetry, stopBlockedRetry, stopHeartbeat]);
  renewLeaseRef.current = renewLease;

  const checkAgain = useCallback(async () => {
    setState({ status: "loading" });
    try {
      await tryAcquire("acquire");
    } catch {
      setState({ status: "blocked", deviceHint: "Another device" });
    }
  }, [tryAcquire]);

  const takeOver = useCallback(async () => {
    setState({ status: "loading" });
    try {
      await tryAcquire("takeover");
    } catch {
      setState({ status: "blocked", deviceHint: "Another device" });
    }
  }, [tryAcquire]);

  useEffect(() => {
    if (!enabled || !gameId) {
      setState({ status: "active" });
      return;
    }

    let cancelled = false;

    const leaseId = getOrCreateLeaseId(gameId);
    leaseIdRef.current = leaseId;

    const release = () => {
      if (!hasLeaseRef.current) return;
      releaseLease(gameId, leaseId);
      hasLeaseRef.current = false;
    };

    const handlePageHide = () => release();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && hasLeaseRef.current) {
        void renewLease();
      }
    };

    void (async () => {
      try {
        await tryAcquire("acquire");
      } catch {
        if (!cancelled) {
          setState({ status: "blocked", deviceHint: "Could not open dashboard." });
          startBlockedRetry();
        }
      }
    })();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      stopHeartbeat();
      stopBlockedRetry();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      // Do not release on React unmount: client navigations (e.g. dashboard → courts view)
      // reuse the same tab leaseId and a release here would delete the next page's lease.
    };
  }, [
    enabled,
    gameId,
    renewLease,
    startBlockedRetry,
    startHeartbeat,
    stopBlockedRetry,
    stopHeartbeat,
    tryAcquire,
  ]);

  return {
    leaseState: state,
    checkAgain,
    takeOver,
    hasDashboardLease: !enabled || state.status === "active",
  };
}

/** Read-only lease check for pages like leaderboard (no acquire/heartbeat). */
export function useOperatorDashboardLeaseCheck(gameId: string, enabled: boolean) {
  const [state, setState] = useState<"loading" | "active" | "blocked">(() =>
    enabled ? "loading" : "active",
  );

  useEffect(() => {
    if (!enabled || !gameId) {
      setState("active");
      return;
    }

    let cancelled = false;
    const leaseId = getStoredLeaseId(gameId);
    if (!leaseId) {
      setState("blocked");
      return;
    }

    void (async () => {
      try {
        const { response, payload } = await postLease(gameId, leaseId, "check");
        if (cancelled) return;
        if (response.ok && payload.status === "active") {
          setState("active");
          return;
        }
        setState("blocked");
      } catch {
        if (!cancelled) setState("blocked");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, gameId]);

  return {
    hasDashboardLease: !enabled || state === "active",
    leaseCheckState: state,
  };
}
