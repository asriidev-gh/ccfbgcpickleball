"use client";

import { useEffect, useState } from "react";

import { LeaderboardStandings, type LeaderboardRow } from "@/components/game/leaderboard-standings";
import { LeaderboardTable } from "@/components/game/leaderboard-table";
import {
  LeaderboardViewToggle,
  loadLeaderboardView,
  saveLeaderboardView,
  type LeaderboardViewMode,
} from "@/components/game/leaderboard-view-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LEADERBOARD_DESKTOP_MEDIA,
  defaultLeaderboardView,
} from "@/lib/leaderboard-viewport";
import { cn } from "@/lib/utils";

type LeaderboardSectionProps = {
  rows: LeaderboardRow[];
  compact?: boolean;
};

export function LeaderboardSection({ rows, compact = false }: LeaderboardSectionProps) {
  const [view, setView] = useState<LeaderboardViewMode>("cards");

  useEffect(() => {
    setView(loadLeaderboardView());

    const mq = window.matchMedia(LEADERBOARD_DESKTOP_MEDIA);
    const onViewportChange = () => {
      if (!localStorage.getItem(LEADERBOARD_VIEW_STORAGE_KEY)) {
        setView(defaultLeaderboardView());
      }
    };
    mq.addEventListener("change", onViewportChange);
    return () => mq.removeEventListener("change", onViewportChange);
  }, []);

  const handleViewChange = (next: LeaderboardViewMode) => {
    setView(next);
    saveLeaderboardView(next);
  };

  return (
    <Card className={cn("glass-panel leaderboard-panel min-w-0", compact && "h-full")}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Standings</CardTitle>
          <p className="caption">
            {rows.length} {rows.length === 1 ? "player" : "players"} · sorted by wins
          </p>
        </div>
        <LeaderboardViewToggle value={view} onChange={handleViewChange} />
      </CardHeader>
      <CardContent>
        {view === "table" ? (
          <LeaderboardTable rows={rows} />
        ) : (
          <LeaderboardStandings rows={rows} compact={compact} />
        )}
      </CardContent>
    </Card>
  );
}
