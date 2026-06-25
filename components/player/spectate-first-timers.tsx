"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, HandHeart, Loader2, Sparkles, UserRoundPlus } from "lucide-react";
import { useState } from "react";

import { FirstTimerPill } from "@/components/game/leaderboard-standings";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GameFirstTimerPlayer, GameFirstTimers } from "@/lib/game-first-timers-shared";
import { cn, formatPlayerTableName } from "@/lib/utils";

export function spectateFirstTimersQueryKey(gameId: string) {
  return ["spectate-first-timers", gameId] as const;
}

function buildFirstTimersGreeting(players: GameFirstTimerPlayer[]) {
  if (players.length === 0) {
    return "Players in this session visiting for the first time with this club.";
  }

  if (players.length === 1) {
    const name =
      players[0].firstName?.trim() ||
      formatPlayerTableName(players[0].firstName, players[0].lastName);
    return `Welcome, ${name}! So glad you're here for your first session — we're happy to have you on court.`;
  }

  return `A warm welcome to our ${players.length} newcomers — your first session with this club starts here. Let's make them feel right at home!`;
}

function playerFirstTimerGreeting(player: GameFirstTimerPlayer) {
  const name = player.firstName?.trim() || "friend";
  return `Welcome, ${name}! Great to have you with us.`;
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
  const greeting = buildFirstTimersGreeting(players);

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
          <Clock className="first-timers-badge-icon mr-1 h-3 w-3 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
          1st: {count}
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="first-timers-dialog max-h-[85vh] max-w-lg overflow-hidden sm:max-w-xl">
          <div className="first-timers-dialog-hero">
            <div className="first-timers-dialog-icons" aria-hidden>
              <HandHeart className="first-timers-welcome-icon first-timers-welcome-icon--heart" />
              <UserRoundPlus className="first-timers-welcome-icon first-timers-welcome-icon--user" />
              <Sparkles className="first-timers-welcome-icon first-timers-welcome-icon--sparkles" />
            </div>

            <DialogHeader className="relative z-10 gap-2 text-left">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="size-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
                1st timers
              </DialogTitle>
              <p className="first-timers-greeting text-sm leading-relaxed text-foreground/90">
                {isLoading ? "Gathering a warm welcome…" : greeting}
              </p>
            </DialogHeader>
          </div>

          <div className="first-timers-dialog-body">
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
                  <li key={player.playerId} className="first-timers-player-card">
                    <PlayerAvatar player={player} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 truncate font-medium">
                        <span className="truncate">
                          {formatPlayerTableName(player.firstName, player.lastName)}
                        </span>
                        <FirstTimerPill />
                      </p>
                      <p className="first-timers-player-greeting">
                        {playerFirstTimerGreeting(player)}
                      </p>
                      <p className="text-sm text-muted-foreground">First session with this club</p>
                    </div>
                    <HandHeart
                      className="size-4 shrink-0 text-sky-500/80 dark:text-sky-300/90"
                      aria-hidden
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
