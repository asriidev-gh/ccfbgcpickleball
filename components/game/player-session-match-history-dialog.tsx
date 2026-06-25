"use client";

import { Loader2, Trophy } from "lucide-react";
import { useMemo } from "react";

import { MatchHistoryList, type MatchHistoryView } from "@/components/game/match-history-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatSessionRecordLabel } from "@/lib/games-played-map";
import { filterMatchesForViewer } from "@/lib/match-history-filter";

type PlayerSessionMatchHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
  matches: MatchHistoryView[];
  isLoading?: boolean;
};

export function PlayerSessionMatchHistoryDialog({
  open,
  onOpenChange,
  gameId,
  playerId,
  playerName,
  wins,
  losses,
  matches,
  isLoading = false,
}: PlayerSessionMatchHistoryDialogProps) {
  const playerMatches = useMemo(
    () => filterMatchesForViewer(matches, [playerId]),
    [matches, playerId],
  );
  const recordLabel = formatSessionRecordLabel({
    wins,
    losses,
    gamesPlayed: wins + losses,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,40rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" aria-hidden />
            {playerName}'s matches
          </DialogTitle>
          <DialogDescription>
            {recordLabel} this session · {playerMatches.length}{" "}
            {playerMatches.length === 1 ? "match" : "matches"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div
              className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading match history…
            </div>
          ) : (
            <MatchHistoryList
              gameId={gameId}
              matches={playerMatches}
              editable={false}
              emptyMessage="No matches recorded for this player yet."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
