"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, History, Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildGameHistoryLeaderboardHref,
} from "@/lib/leaderboard-navigation";
import {
  fetchSpectatePlayerGameHistory,
  spectatePlayerGameHistoryQueryKey,
} from "@/lib/fetch-spectate-player-game-history";
import { spectatorNavQueryOptions } from "@/lib/spectator-query-options";

export function SpectatePlayerGameHistoryDialog({
  gameId,
  playerId,
  open,
  onOpenChange,
}: {
  gameId: string;
  playerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: spectatePlayerGameHistoryQueryKey(gameId, playerId),
    queryFn: () => fetchSpectatePlayerGameHistory(gameId, playerId),
    enabled: open && Boolean(playerId),
    ...spectatorNavQueryOptions,
  });

  const games = data?.games ?? [];

  const openSessionLeaderboard = (sessionGameId: string) => {
    onOpenChange(false);
    router.push(buildGameHistoryLeaderboardHref(sessionGameId, gameId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Game History</DialogTitle>
          <DialogDescription>
            Ended open play sessions you joined. Select a session to view its leaderboard.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading game history…
          </div>
        ) : error ? (
          <p className="py-6 text-destructive">
            {error instanceof Error ? error.message : "Failed to load game history."}
          </p>
        ) : games.length === 0 ? (
          <p className="py-6 text-muted-foreground">
            No ended sessions yet. Your past open play standings will appear here after sessions
            end.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {games.map((session) => (
              <li key={session.gameId}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between gap-3 px-3 py-3 text-left"
                  onClick={() => openSessionLeaderboard(session.gameId)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{session.title}</span>
                    {session.scheduleLabel ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {session.scheduleLabel}
                      </span>
                    ) : null}
                    {session.venueLabel ? (
                      <span className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 break-words">{session.venueLabel}</span>
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !error && games.length > 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="size-3.5 shrink-0" aria-hidden />
            {games.length} ended session{games.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
