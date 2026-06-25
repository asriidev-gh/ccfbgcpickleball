"use client";

import { useQuery } from "@tanstack/react-query";
import { Balloon, Cake, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { useState } from "react";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GameBirthdayPlayer, GameBirthdaysThisMonth } from "@/lib/game-birthdays-this-month-shared";
import { cn, formatPlayerTableName } from "@/lib/utils";

export function spectateBirthdaysThisMonthQueryKey(gameId: string) {
  return ["spectate-birthdays-this-month", gameId] as const;
}

function buildBirthdaysGreeting(players: GameBirthdayPlayer[]) {
  if (players.length === 0) {
    return "Players in this session celebrating a birthday this month.";
  }

  if (players.length === 1) {
    const name =
      players[0].firstName?.trim() ||
      formatPlayerTableName(players[0].firstName, players[0].lastName);
    return `Happy birthday, ${name}! Wishing you a wonderful day and an amazing year on and off the court.`;
  }

  return `Happy birthday to our ${players.length} birthday stars this month — let's shower them with cheers and good vibes!`;
}

function playerBirthdayGreeting(player: GameBirthdayPlayer) {
  const name = player.firstName?.trim() || "friend";
  return `Happy birthday, ${name}!`;
}

export function SpectateBirthdaysThisMonthBadge({
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
    queryKey: spectateBirthdaysThisMonthQueryKey(gameId),
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/birthdays-this-month`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to load birthdays this month.");
      }
      return payload as GameBirthdaysThisMonth;
    },
    enabled: open,
    staleTime: 30_000,
  });

  if (count <= 0) return null;

  const players = data?.players ?? [];
  const greeting = buildBirthdaysGreeting(players);

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label={`Birthday this month: ${count}. Show players.`}
      >
        <Badge variant="outline" className="game-dashboard-meta-badge w-fit cursor-pointer hover:bg-muted/60">
          <Cake className="birthdays-month-badge-icon mr-1 h-3 w-3 shrink-0 text-pink-600 dark:text-pink-300" aria-hidden />
          Birthday this Month: {count}
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="birthdays-month-dialog max-h-[85vh] max-w-lg overflow-hidden sm:max-w-xl">
          <div className="birthdays-month-dialog-hero">
            <div className="birthdays-month-dialog-icons" aria-hidden>
              <Balloon className="birthdays-month-balloon birthdays-month-balloon--left" />
              <Balloon className="birthdays-month-balloon birthdays-month-balloon--right" />
              <PartyPopper className="birthdays-month-confetti birthdays-month-confetti--popper" />
              <Sparkles className="birthdays-month-confetti birthdays-month-confetti--sparkles" />
            </div>

            <DialogHeader className="relative z-10 gap-2 text-left">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <Cake className="size-5 shrink-0 text-pink-600 dark:text-pink-300" aria-hidden />
                Birthdays this month
              </DialogTitle>
              <p className="birthdays-month-greeting text-sm leading-relaxed text-foreground/90">
                {isLoading ? "Loading birthday celebrations…" : greeting}
              </p>
            </DialogHeader>
          </div>

          <div className="birthdays-month-dialog-body">
            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : error ? (
              <p className="py-6 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load birthdays."}
              </p>
            ) : players.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No birthdays this month.</p>
            ) : (
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.playerId} className="birthdays-month-player-card">
                    <PlayerAvatar player={player} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {formatPlayerTableName(player.firstName, player.lastName)}
                      </p>
                      <p className="birthdays-month-player-greeting">
                        {playerBirthdayGreeting(player)}
                      </p>
                      <p className="text-sm text-muted-foreground">{player.birthdayLabel}</p>
                    </div>
                    <Cake
                      className="size-4 shrink-0 text-pink-500/80 dark:text-pink-300/90"
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
