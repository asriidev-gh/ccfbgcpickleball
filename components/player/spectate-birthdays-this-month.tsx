"use client";

import { useQuery } from "@tanstack/react-query";
import { Cake, Loader2 } from "lucide-react";
import { useState } from "react";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GameBirthdaysThisMonth } from "@/lib/game-birthdays-this-month-shared";
import { formatPlayerTableName, cn } from "@/lib/utils";

export function spectateBirthdaysThisMonthQueryKey(gameId: string) {
  return ["spectate-birthdays-this-month", gameId] as const;
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
          <Cake className="mr-1 h-3 w-3 shrink-0 text-pink-600 dark:text-pink-300" aria-hidden />
          Birthday this Month: {count}
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Birthdays this month</DialogTitle>
            <DialogDescription>
              Players in this session celebrating a birthday this month.
            </DialogDescription>
          </DialogHeader>

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
                <li
                  key={player.playerId}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
                >
                  <PlayerAvatar player={player} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {formatPlayerTableName(player.firstName, player.lastName)}
                    </p>
                    <p className="text-sm text-muted-foreground">{player.birthdayLabel}</p>
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
