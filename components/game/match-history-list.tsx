"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatPlayerDisplayName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type MatchHistoryView = {
  _id: string;
  courtNumber: number;
  teamAPlayerIds: { firstName: string; lastName: string }[];
  teamBPlayerIds: { firstName: string; lastName: string }[];
  winnerTeam: "A" | "B";
  durationSeconds: number;
  endedAt: string;
};

const MATCH_HISTORY_PAGE_SIZE = 5;

function formatPlayerNames(players: MatchHistoryView["teamAPlayerIds"]) {
  if (!players.length) return "—";
  return players
    .map((p) => formatPlayerDisplayName(p.firstName, p.lastName))
    .join(", ");
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function MatchHistoryList({ matches }: { matches: MatchHistoryView[] }) {
  const [visibleCount, setVisibleCount] = useState(MATCH_HISTORY_PAGE_SIZE);
  const prevMatchCount = useRef(matches.length);

  useEffect(() => {
    if (matches.length < prevMatchCount.current) {
      setVisibleCount(MATCH_HISTORY_PAGE_SIZE);
    }
    prevMatchCount.current = matches.length;
  }, [matches.length]);

  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground">
        No matches yet. End a court game and pick the winning team to record a match.
      </p>
    );
  }

  const visibleMatches = matches.slice(0, visibleCount);
  const remaining = matches.length - visibleCount;
  const hasMore = remaining > 0;

  return (
    <div className="match-history-list space-y-2">
      {visibleMatches.map((match) => {
        const teamAWon = match.winnerTeam === "A";
        return (
          <article
            key={match._id}
            className="match-history-item surface-muted rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="body-lg font-medium">Court {match.courtNumber}</span>
                <Badge variant={teamAWon ? "default" : "outline"} className="match-history-winner-a">
                  {teamAWon ? (
                    <>
                      <Trophy className="mr-1 h-3 w-3" />
                      Team A won
                    </>
                  ) : (
                    "Team A"
                  )}
                </Badge>
                <span className="text-muted-foreground">vs</span>
                <Badge variant={!teamAWon ? "default" : "outline"} className="match-history-winner-b">
                  {!teamAWon ? (
                    <>
                      <Trophy className="mr-1 h-3 w-3" />
                      Team B won
                    </>
                  ) : (
                    "Team B"
                  )}
                </Badge>
              </div>
              <p className="caption shrink-0">
                {formatDuration(match.durationSeconds)}
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span suppressHydrationWarning>
                  {formatDistanceToNow(new Date(match.endedAt), { addSuffix: true })}
                </span>
              </p>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              <p className="caption">
                <span className="font-medium text-foreground">Team A:</span>{" "}
                {formatPlayerNames(match.teamAPlayerIds)}
              </p>
              <p className="caption">
                <span className="font-medium text-foreground">Team B:</span>{" "}
                {formatPlayerNames(match.teamBPlayerIds)}
              </p>
            </div>
          </article>
        );
      })}
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          className="match-history-show-more w-full"
          onClick={() =>
            setVisibleCount((count) =>
              Math.min(count + MATCH_HISTORY_PAGE_SIZE, matches.length),
            )
          }
        >
          <ChevronDown className="mr-2 h-4 w-4" />
          Show more
          <span className="ml-1 text-muted-foreground">
            ({Math.min(remaining, MATCH_HISTORY_PAGE_SIZE)} more)
          </span>
        </Button>
      ) : null}
    </div>
  );
}
