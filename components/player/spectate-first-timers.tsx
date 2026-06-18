"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { FirstTimerPill } from "@/components/game/leaderboard-standings";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GameFirstTimers } from "@/lib/game-first-timers-shared";
import { cn, formatPlayerTableName } from "@/lib/utils";

export function spectateFirstTimersQueryKey(gameId: string) {
  return ["spectate-first-timers", gameId] as const;
}

export function SpectateFirstTimersBadge({
  gameId,
  count,
  className,
}: {
  gameId: string;
  count: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: spectateFirstTimersQueryKey(gameId),
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/first-timers`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to load first timers.");
      }
      return payload as GameFirstTimers;
    },
    enabled: open,
    staleTime: 30_000,
  });

  if (count <= 0) return null;

  const players = data?.players ?? [];

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label={`1st timer: ${count}. Show players.`}
      >
        <Badge variant="outline" className="game-dashboard-meta-badge w-fit cursor-pointer hover:bg-muted/60">
          <Sparkles className="mr-1 h-3 w-3 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
          1st Timer: {count}
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>1st timers</DialogTitle>
            <DialogDescription>
              Players in this session visiting for the first time with this club.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load first timers."}
            </p>
          ) : players.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No first timers in this session.</p>
          ) : (
            <ul className="space-y-2">
              {players.map((player) => (
                <li
                  key={player.playerId}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
                >
                  <PlayerAvatar player={player} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 truncate font-medium">
                      <span className="truncate">
                        {formatPlayerTableName(player.firstName, player.lastName)}
                      </span>
                      <FirstTimerPill />
                    </p>
                    <p className="text-sm text-muted-foreground">First session with this club</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
