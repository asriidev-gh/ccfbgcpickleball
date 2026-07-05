"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Gauge, LayoutGrid, Loader2, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CourtsViewLayoutToggle,
  loadCourtsViewLayout,
  saveCourtsViewLayout,
  type CourtsViewLayout,
} from "@/components/game/courts-view-layout-toggle";
import {
  CourtsViewPhotosToggle,
  courtsViewShowsPhotosToggle,
  loadCourtsViewShowPhotos,
  resolveCourtsViewShowPlayerPhotos,
  saveCourtsViewShowPhotos,
} from "@/components/game/courts-view-photos-toggle";
import { CourtsViewCourtThemeSelect } from "@/components/game/courts-view-court-theme-select";
import { DashboardPanelFullscreenButton } from "@/components/game/dashboard-panel-fullscreen-button";
import { SpectatorNextOnQueueButton } from "@/components/game/spectator-next-on-queue-dialog";
import { GameCourtsGrid } from "@/components/game/game-courts-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  getPublicErrorMessage,
  shouldSuppressUserNotification,
} from "@/lib/infrastructure-error";
import {
  loadCourtsViewCourtTheme,
  saveCourtsViewCourtTheme,
  type CourtsViewCourtTheme,
} from "@/lib/courts-view-court-theme";
import { COURTS_VIEW_DESKTOP_MEDIA } from "@/lib/courts-view-viewport";
import {
  fetchSpectateGame,
  isSpectatorViewUnavailableError,
  spectatorLiveQueryKey,
} from "@/lib/fetch-spectate-game";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerSessionStatsMap,
} from "@/lib/games-played-map";
import { SPECTATOR_LIVE_POLL_MS } from "@/lib/spectator-polling";
import { spectatorLiveQueryOptions } from "@/lib/spectator-query-options";
import { cn } from "@/lib/utils";

function SpectatorCourtViewExitLinkContent({
  iconPosition = "start",
}: {
  iconPosition?: "start" | "end";
}) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 sm:hidden">
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Exit
      </span>
      <span className="hidden sm:inline-flex sm:items-center">
        {iconPosition === "start" ? (
          <ArrowLeft className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
        ) : null}
        Game Dashboard
        {iconPosition === "end" ? (
          <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" aria-hidden />
        ) : null}
      </span>
    </>
  );
}

export function SpectatorCourtsView() {
  const params = useParams<{ id: string }>();
  const gameId = params.id ?? "";
  const courtsSectionRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<CourtsViewLayout>("list");
  const [showPhotos, setShowPhotos] = useState(true);
  const [viewPrefsReady, setViewPrefsReady] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null);
  const [courtTheme, setCourtTheme] = useState<CourtsViewCourtTheme>("classic");

  useEffect(() => {
    setLayout(loadCourtsViewLayout());
    setShowPhotos(loadCourtsViewShowPhotos());
    setCourtTheme(loadCourtsViewCourtTheme());
    setViewPrefsReady(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(COURTS_VIEW_DESKTOP_MEDIA);
    const syncViewport = () => setIsDesktopViewport(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const displayLayout =
    viewPrefsReady && isDesktopViewport === true ? layout : "list";
  const displayShowPhotos =
    viewPrefsReady && isDesktopViewport === true ? showPhotos : true;
  const displayShowPlayerPhotos = resolveCourtsViewShowPlayerPhotos(
    displayLayout,
    displayShowPhotos,
  );

  const liveQuery = useQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live"),
    enabled: Boolean(gameId),
    ...spectatorLiveQueryOptions,
    refetchInterval: SPECTATOR_LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const liveLeaderboard = liveQuery.data?.leaderboard ?? [];

  const playerSessionStats = useMemo(
    () => buildPlayerSessionStatsMap(liveLeaderboard),
    [liveLeaderboard],
  );

  const queueWithStats = useMemo(
    () =>
      (liveQuery.data?.queue ?? []).map((entry) =>
        attachSessionStatsToQueueEntry(entry, playerSessionStats),
      ),
    [liveQuery.data?.queue, playerSessionStats],
  );

  const handleLayoutChange = (nextLayout: CourtsViewLayout) => {
    setLayout(nextLayout);
    setViewPrefsReady(true);
    saveCourtsViewLayout(nextLayout);

    if (nextLayout === "list") {
      setShowPhotos(true);
      saveCourtsViewShowPhotos(true);
    } else if (nextLayout === "tiles-3" && layout !== "tiles-3") {
      setShowPhotos(false);
      saveCourtsViewShowPhotos(false);
    }
  };

  const handleShowPhotosChange = (nextShowPhotos: boolean) => {
    setShowPhotos(nextShowPhotos);
    setViewPrefsReady(true);
    saveCourtsViewShowPhotos(nextShowPhotos);
  };

  const handleCourtThemeChange = (nextTheme: CourtsViewCourtTheme) => {
    setCourtTheme(nextTheme);
    saveCourtsViewCourtTheme(nextTheme);
  };

  const game = liveQuery.data?.game;
  const courts = liveQuery.data?.courts ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="my-games-page-intro flex items-start gap-3">
        <span className="my-games-page-intro__icon flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <LayoutGrid className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="page-title">Court View</h1>
            <CourtsViewCourtThemeSelect value={courtTheme} onChange={handleCourtThemeChange} />
          </div>
          <p className="caption mt-0.5 max-w-xl">
            Courts-only view for this open play session.
          </p>
        </div>
      </div>

      <div className="hidden flex-col gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/games/${gameId}/spectate`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex w-fit",
          )}
          aria-label="Exit to game dashboard"
        >
          <SpectatorCourtViewExitLinkContent iconPosition="start" />
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CourtsViewLayoutToggle value={displayLayout} onChange={handleLayoutChange} />
          {courtsViewShowsPhotosToggle(displayLayout) ? (
            <CourtsViewPhotosToggle value={displayShowPhotos} onChange={handleShowPhotosChange} />
          ) : null}
          {liveQuery.isRefetching ? (
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

      {liveQuery.isLoading ? (
        <div className="flex min-h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Loading courts…
        </div>
      ) : liveQuery.isError ? (
        isSpectatorViewUnavailableError(liveQuery.error) ||
        shouldSuppressUserNotification(liveQuery.error) ? (
          <div className="flex min-h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading courts…
          </div>
        ) : (
          <Card className="glass-panel">
            <CardContent className="py-10 text-center text-destructive">
              {getPublicErrorMessage(liveQuery.error, "Failed to load courts.")}
            </CardContent>
          </Card>
        )
      ) : !game ? (
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-muted-foreground">
            Game not found.
          </CardContent>
        </Card>
      ) : (
        <Card
          ref={courtsSectionRef}
          className="glass-panel courts-panel dashboard-panel dashboard-panel--courts relative"
        >
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 sm:top-4 sm:right-4">
            <Link
              href={`/games/${gameId}/spectate`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex shrink-0",
              )}
              aria-label="Exit to game dashboard"
            >
              <SpectatorCourtViewExitLinkContent iconPosition="end" />
            </Link>
            <DashboardPanelFullscreenButton
              containerRef={courtsSectionRef}
              panelName="courts"
            />
          </div>
          <CardHeader className="pb-3">
            <div className="min-w-0 space-y-1 pr-[7.25rem] sm:pr-52">
              <CardTitle className="truncate">{game.title}</CardTitle>
              <p className="caption flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" aria-hidden />
                  {game.openPlayType}
                </span>
                {game.openPlayTimeRange ? (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span>{game.openPlayTimeRange}</span>
                  </>
                ) : null}
              </p>
            </div>
          </CardHeader>
          <CardContent className="dashboard-panel-content">
            <GameCourtsGrid
              courts={courts}
              leaderboard={liveLeaderboard}
              playerSessionStats={playerSessionStats}
              gameId={gameId}
              layout={displayLayout}
              showPlayerPhotos={displayShowPlayerPhotos}
              layoutVariant="pickleball"
              courtTheme={courtTheme}
              showLeaderboardRank
              summaryAddon={
                <SpectatorNextOnQueueButton
                  queue={queueWithStats}
                  showLeaderboardRank
                  leaderboard={liveLeaderboard}
                />
              }
              getCourtCardProps={() => ({
                hideEndGame: true,
                onEndGame: () => {},
              })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
