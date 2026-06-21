"use client";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import {
  courtsViewLayoutGridClassName,
  defaultCourtsViewLayout,
  type CourtsViewLayout,
} from "@/components/game/courts-view-layout-toggle";
import {
  courtsViewPhotosGridClassName,
  defaultCourtsViewShowPhotos,
} from "@/components/game/courts-view-photos-toggle";
import {
  buildPlayerSessionStatsMap,
  buildPlayerLeaderboardRankMap,
  type LeaderboardGamesPlayedRow,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import type { CourtsViewCourtTheme } from "@/lib/courts-view-court-theme";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";

type CourtCardOperatorProps = Omit<
  ComponentProps<typeof CourtCard>,
  "court" | "playerSessionStats" | "elementId"
>;

type GameCourtsGridProps = {
  courts: CourtView[];
  leaderboard?: LeaderboardGamesPlayedRow[];
  playerSessionStats?: Map<string, PlayerSessionStats>;
  gameId?: string;
  className?: string;
  showSummary?: boolean;
  summaryAddon?: ReactNode;
  showLeaderboardRank?: boolean;
  layout?: CourtsViewLayout;
  showPlayerPhotos?: boolean;
  layoutVariant?: "standard" | "pickleball";
  courtTheme?: CourtsViewCourtTheme;
  getCourtCardProps?: (court: CourtView) => CourtCardOperatorProps;
};

export function GameCourtsGrid({
  courts,
  leaderboard,
  playerSessionStats: playerSessionStatsProp,
  gameId,
  className,
  showSummary = true,
  summaryAddon,
  showLeaderboardRank = false,
  layout = defaultCourtsViewLayout(),
  showPlayerPhotos = defaultCourtsViewShowPhotos(),
  layoutVariant = "standard",
  courtTheme = "classic",
  getCourtCardProps,
}: GameCourtsGridProps) {
  const playerSessionStats =
    playerSessionStatsProp ?? buildPlayerSessionStatsMap(leaderboard);
  const playerLeaderboardRanks = useMemo(
    () => (showLeaderboardRank ? buildPlayerLeaderboardRankMap(leaderboard) : new Map()),
    [leaderboard, showLeaderboardRank],
  );

  if (courts.length === 0) {
    return <p className="text-muted-foreground">No courts configured.</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showSummary ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <CourtsSummary courts={courts} />
          {summaryAddon}
        </div>
      ) : null}
      <div
        className={cn(
          courtsViewLayoutGridClassName(layout),
          courtsViewPhotosGridClassName(showPlayerPhotos),
          layoutVariant === "pickleball" && "court-grid-theme",
        )}
        data-court-theme={layoutVariant === "pickleball" ? courtTheme : undefined}
      >
        {courts.map((court) => {
          const operatorProps = getCourtCardProps?.(court) ?? {
            hideEndGame: true,
            onEndGame: () => {},
          };

          return (
            <CourtCard
              key={court._id}
              elementId={
                gameId != null
                  ? `court-card-${gameId}-${court.courtNumber}`
                  : `court-card-${court.courtNumber}`
              }
              court={court}
              playerSessionStats={playerSessionStats}
              showLeaderboardRank={showLeaderboardRank}
              playerLeaderboardRanks={playerLeaderboardRanks}
              layoutVariant={layoutVariant}
              {...operatorProps}
            />
          );
        })}
      </div>
    </div>
  );
}
