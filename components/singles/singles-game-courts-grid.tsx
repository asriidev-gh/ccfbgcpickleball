"use client";

import { CourtsSummary, type CourtView } from "@/components/game/court-card";
import {
  courtsViewLayoutGridClassName,
  defaultCourtsViewLayout,
  type CourtsViewLayout,
} from "@/components/game/courts-view-layout-toggle";
import {
  courtsViewPhotosGridClassName,
  defaultCourtsViewShowPhotos,
} from "@/components/game/courts-view-photos-toggle";
import { SinglesCourtCard } from "@/components/singles/singles-court-card";
import type { CourtsViewCourtTheme } from "@/lib/courts-view-court-theme";
import {
  buildPlayerSessionStatsMap,
  buildSessionLeaderboardRankMap,
  type LeaderboardGamesPlayedRow,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";

type SinglesCourtCardProps = Omit<
  ComponentProps<typeof SinglesCourtCard>,
  "court" | "playerSessionStats" | "playerLeaderboardRanks"
>;

type SinglesGameCourtsGridProps = {
  courts: CourtView[];
  leaderboard?: LeaderboardGamesPlayedRow[];
  playerSessionStats?: Map<string, PlayerSessionStats>;
  playerLeaderboardRanks?: Map<string, number>;
  gameId?: string;
  className?: string;
  showSummary?: boolean;
  summaryAddon?: ReactNode;
  layout?: CourtsViewLayout;
  showPlayerPhotos?: boolean;
  courtTheme?: CourtsViewCourtTheme;
  getCourtCardProps?: (court: CourtView) => SinglesCourtCardProps;
};

export function SinglesGameCourtsGrid({
  courts,
  leaderboard,
  playerSessionStats: playerSessionStatsProp,
  playerLeaderboardRanks: playerLeaderboardRanksProp,
  gameId,
  className,
  showSummary = true,
  summaryAddon,
  layout = defaultCourtsViewLayout(),
  showPlayerPhotos = defaultCourtsViewShowPhotos(),
  courtTheme = "classic",
  getCourtCardProps,
}: SinglesGameCourtsGridProps) {
  const playerSessionStats =
    playerSessionStatsProp ?? buildPlayerSessionStatsMap(leaderboard);
  const playerLeaderboardRanks = useMemo(
    () => playerLeaderboardRanksProp ?? buildSessionLeaderboardRankMap(leaderboard, []),
    [leaderboard, playerLeaderboardRanksProp],
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
          "court-grid-theme",
        )}
        data-court-theme={courtTheme}
      >
        {courts.map((court) => {
          const operatorProps = getCourtCardProps?.(court) ?? {
            onEndGame: () => {},
          };

          return (
            <SinglesCourtCard
              key={court._id}
              court={court}
              playerSessionStats={playerSessionStats}
              playerLeaderboardRanks={playerLeaderboardRanks}
              {...operatorProps}
            />
          );
        })}
      </div>
    </div>
  );
}
