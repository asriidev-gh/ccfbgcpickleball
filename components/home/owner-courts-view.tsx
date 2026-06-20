"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CourtsViewLayoutToggle,
  loadCourtsViewLayout,
  saveCourtsViewLayout,
  type CourtsViewLayout,
} from "@/components/game/courts-view-layout-toggle";
import {
  CourtsViewPhotosToggle,
  loadCourtsViewShowPhotos,
  saveCourtsViewShowPhotos,
} from "@/components/game/courts-view-photos-toggle";
import {
  CourtsViewSessionsSelect,
  loadHiddenCourtsViewSessionIds,
  saveHiddenCourtsViewSessionIds,
} from "@/components/game/courts-view-sessions-select";
import { OwnerSessionCourtsSection } from "@/components/home/owner-session-courts-section";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  COURTS_VIEW_FOCUS_GAME_ID_PARAM,
  hiddenCourtsViewSessionIdsForFocus,
} from "@/lib/courts-view-focus";
import { COURTS_VIEW_DESKTOP_MEDIA } from "@/lib/courts-view-viewport";
import type { OwnerCourtsViewPayload } from "@/lib/owner-courts-view-payload";
import { cn } from "@/lib/utils";

const OWNER_COURTS_VIEW_POLL_MS = 30_000;

async function fetchOwnerCourtsView() {
  const response = await fetch("/api/games/courts-view");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Failed to load courts view.");
  return payload as OwnerCourtsViewPayload;
}

export function OwnerCourtsView() {
  const searchParams = useSearchParams();
  const focusGameId = searchParams.get(COURTS_VIEW_FOCUS_GAME_ID_PARAM);
  const appliedFocusGameIdRef = useRef<string | null>(null);

  const [layout, setLayout] = useState<CourtsViewLayout>("list");
  const [showPhotos, setShowPhotos] = useState(true);
  const [viewPrefsReady, setViewPrefsReady] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null);
  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(() => new Set());
  const [hiddenSessionsReady, setHiddenSessionsReady] = useState(false);

  useEffect(() => {
    setLayout(loadCourtsViewLayout());
    setShowPhotos(loadCourtsViewShowPhotos());
    setHiddenSessionIds(loadHiddenCourtsViewSessionIds());
    setViewPrefsReady(true);
    setHiddenSessionsReady(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(COURTS_VIEW_DESKTOP_MEDIA);
    const syncViewport = () => setIsDesktopViewport(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const handleLayoutChange = (nextLayout: CourtsViewLayout) => {
    setLayout(nextLayout);
    setViewPrefsReady(true);
    saveCourtsViewLayout(nextLayout);

    if (nextLayout === "tiles-3" && layout !== "tiles-3") {
      setShowPhotos(false);
      saveCourtsViewShowPhotos(false);
    }
  };

  const handleShowPhotosChange = (nextShowPhotos: boolean) => {
    setShowPhotos(nextShowPhotos);
    setViewPrefsReady(true);
    saveCourtsViewShowPhotos(nextShowPhotos);
  };

  const displayLayout =
    viewPrefsReady && isDesktopViewport === true ? layout : "list";
  const displayShowPhotos =
    viewPrefsReady && isDesktopViewport === true ? showPhotos : true;

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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/my-games"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex w-fit")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to My Games
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="hidden items-center gap-2 sm:flex">
            <CourtsViewLayoutToggle value={displayLayout} onChange={handleLayoutChange} />
            <CourtsViewPhotosToggle value={displayShowPhotos} onChange={handleShowPhotosChange} />
          </div>
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
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-destructive">
            {query.error instanceof Error ? query.error.message : "Failed to load courts view."}
          </CardContent>
        </Card>
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
              layout={displayLayout}
              showPlayerPhotos={displayShowPhotos}
            />
          ))}
        </div>
      )}
    </div>
  );
}
