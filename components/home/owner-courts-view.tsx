"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CourtsViewSessionsSelect,
  loadHiddenCourtsViewSessionIds,
  saveHiddenCourtsViewSessionIds,
} from "@/components/game/courts-view-sessions-select";
import { OwnerSessionCourtsSection } from "@/components/home/owner-session-courts-section";
import { CourtsViewCourtThemeSelect } from "@/components/game/courts-view-court-theme-select";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getPublicErrorMessage,
  sanitizeErrorMessage,
  shouldSuppressUserNotification,
} from "@/lib/infrastructure-error";
import {
  COURTS_VIEW_FOCUS_GAME_ID_PARAM,
  hiddenCourtsViewSessionIdsForFocus,
} from "@/lib/courts-view-focus";
import {
  loadCourtsViewCourtTheme,
  saveCourtsViewCourtTheme,
  type CourtsViewCourtTheme,
} from "@/lib/courts-view-court-theme";
import {
  loadCourtsViewLeaseBannerCollapsed,
  saveCourtsViewLeaseBannerCollapsed,
} from "@/lib/courts-view-lease-banner-pref";
import type { OwnerCourtsViewPayload } from "@/lib/owner-courts-view-payload";
import { cn } from "@/lib/utils";

const OWNER_COURTS_VIEW_POLL_MS = 30_000;

async function fetchOwnerCourtsView() {
  const response = await fetch("/api/games/courts-view");
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(sanitizeErrorMessage(payload.message, "Failed to load courts view."));
  }
  return payload as OwnerCourtsViewPayload;
}

export function OwnerCourtsView() {
  const searchParams = useSearchParams();
  const focusGameId = searchParams.get(COURTS_VIEW_FOCUS_GAME_ID_PARAM);
  const appliedFocusGameIdRef = useRef<string | null>(null);

  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(() => new Set());
  const [hiddenSessionsReady, setHiddenSessionsReady] = useState(false);
  const [courtTheme, setCourtTheme] = useState<CourtsViewCourtTheme>("classic");
  const [leaseBannerCollapsed, setLeaseBannerCollapsed] = useState(false);

  useEffect(() => {
    setHiddenSessionIds(loadHiddenCourtsViewSessionIds());
    setCourtTheme(loadCourtsViewCourtTheme());
    setLeaseBannerCollapsed(loadCourtsViewLeaseBannerCollapsed());
    setHiddenSessionsReady(true);
  }, []);

  const handleCourtThemeChange = (nextTheme: CourtsViewCourtTheme) => {
    setCourtTheme(nextTheme);
    saveCourtsViewCourtTheme(nextTheme);
  };

  const handleLeaseBannerCollapsedChange = useCallback((collapsed: boolean) => {
    setLeaseBannerCollapsed(collapsed);
    saveCourtsViewLeaseBannerCollapsed(collapsed);
  }, []);

  const query = useQuery({
    queryKey: ["games", "courts-view"],
    queryFn: fetchOwnerCourtsView,
    refetchInterval: OWNER_COURTS_VIEW_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const sessions = query.data?.sessions ?? [];

  useEffect(() => {
    if (!hiddenSessionsReady || sessions.length === 0 || !focusGameId) return;
    if (appliedFocusGameIdRef.current === focusGameId) return;
    if (!sessions.some((session) => session.gameId === focusGameId)) return;

    appliedFocusGameIdRef.current = focusGameId;
    const next = hiddenCourtsViewSessionIdsForFocus(sessions, focusGameId);
    setHiddenSessionIds(next);
    saveHiddenCourtsViewSessionIds(next);
  }, [focusGameId, hiddenSessionsReady, sessions]);

  useEffect(() => {
    if (!hiddenSessionsReady || sessions.length === 0) return;

    const activeSessionIds = new Set(sessions.map((session) => session.gameId));
    setHiddenSessionIds((previous) => {
      const next = new Set([...previous].filter((gameId) => activeSessionIds.has(gameId)));
      if (next.size === previous.size) return previous;

      saveHiddenCourtsViewSessionIds(next);
      return next;
    });
  }, [hiddenSessionsReady, sessions]);

  const sessionOptions = useMemo(
    () => sessions.map((session) => ({ gameId: session.gameId, title: session.title })),
    [sessions],
  );

  const visibleSessions = useMemo(() => {
    if (!hiddenSessionsReady) return sessions;
    return sessions.filter((session) => !hiddenSessionIds.has(session.gameId));
  }, [hiddenSessionIds, hiddenSessionsReady, sessions]);

  const handleSessionVisibilityChange = useCallback((gameId: string, visible: boolean) => {
    setHiddenSessionIds((previous) => {
      const next = new Set(previous);
      if (visible) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      saveHiddenCourtsViewSessionIds(next);
      return next;
    });
  }, []);

  const handleToggleAllSessions = useCallback(
    (visible: boolean) => {
      setHiddenSessionIds(() => {
        const next = visible ? new Set<string>() : new Set(sessions.map((session) => session.gameId));
        saveHiddenCourtsViewSessionIds(next);
        return next;
      });
    },
    [sessions],
  );

  return (
    <div className="space-y-6">
      <div className="my-games-page-intro flex items-start gap-3">
        <span className="my-games-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <LayoutGrid className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="page-title">Courts View</h1>
            {!query.isLoading && sessionOptions.length > 1 ? (
              <CourtsViewSessionsSelect
                sessions={sessionOptions}
                hiddenSessionIds={hiddenSessionIds}
                onSessionVisibilityChange={handleSessionVisibilityChange}
                onToggleAll={handleToggleAllSessions}
                disabled={query.isFetching}
              />
            ) : null}
          </div>
          <p className="caption mt-0.5 max-w-xl">
            All courts across your active open play sessions on one page.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/my-games"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex shrink-0")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to My Games
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CourtsViewCourtThemeSelect
            value={courtTheme}
            onChange={handleCourtThemeChange}
          />
          {query.isRefetching ? (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex w-fit items-center pointer-events-none",
              )}
              role="status"
              aria-live="polite"
            >
              <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              Refreshing…
            </span>
          ) : null}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Loading courts…
        </div>
      ) : query.isError ? (
        shouldSuppressUserNotification(query.error) ? (
          <div className="flex min-h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading courts…
          </div>
        ) : (
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-destructive">
            {getPublicErrorMessage(query.error, "Failed to load courts view.")}
          </CardContent>
        </Card>
        )
      ) : sessions.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-muted-foreground">
            No active open play sessions. Start a game from My Games to see courts here.
          </CardContent>
        </Card>
      ) : visibleSessions.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-muted-foreground">
            No sessions selected. Use the sessions menu beside the title to show open play
            sessions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleSessions.map((session) => (
            <OwnerSessionCourtsSection
              key={session.gameId}
              session={session}
              courtTheme={courtTheme}
              leaseBannerCollapsed={leaseBannerCollapsed}
              onLeaseBannerCollapsedChange={handleLeaseBannerCollapsedChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
