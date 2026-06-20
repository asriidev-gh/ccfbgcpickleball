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
  type LeaderboardGamesPlayedRow,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

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
  layout?: CourtsViewLayout;
  showPlayerPhotos?: boolean;
  getCourtCardProps?: (court: CourtView) => CourtCardOperatorProps;
};

export function GameCourtsGrid({
  courts,
  leaderboard,
  playerSessionStats: playerSessionStatsProp,
  gameId,
  className,
  showSummary = true,
  layout = defaultCourtsViewLayout(),
  showPlayerPhotos = defaultCourtsViewShowPhotos(),
  getCourtCardProps,
}: GameCourtsGridProps) {
  const playerSessionStats =
    playerSessionStatsProp ?? buildPlayerSessionStatsMap(leaderboard);

  if (courts.length === 0) {
    return <p className="text-muted-foreground">No courts configured.</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showSummary ? <CourtsSummary courts={courts} /> : null}
      <div
        className={cn(
          courtsViewLayoutGridClassName(layout),
          courtsViewPhotosGridClassName(showPlayerPhotos),
        )}
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
              {...operatorProps}
            />
          );
        })}
      </div>
    </div>
  );
}
