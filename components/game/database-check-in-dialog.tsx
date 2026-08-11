"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getPublicErrorMessage, shouldSuppressUserNotification } from "@/lib/infrastructure-error";
import { operatorQueueQueryKey } from "@/lib/fetch-operator-game";
import { toastOperationError } from "@/lib/toast-error";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  DatabaseCheckInPlayerItem,
  DatabaseCheckInPlayersPage,
} from "@/lib/operator-database-check-in-shared";
import { databaseCheckInPlayersQueryKey } from "@/lib/operator-database-check-in-shared";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function databaseCheckInQueryKey(gameId: string, page: number, search: string) {
  return ["database-check-in-players", gameId, page, search] as const;
}

function queueStatusLabel(status: DatabaseCheckInPlayerItem["queueStatus"]) {
  switch (status) {
    case "queued":
      return "In queue";
    case "on_court":
      return "On court";
    case "done":
      return "Played";
    case "checked_out":
      return "Checked out";
    default:
      return null;
  }
}

function queueStatusVariant(
  status: DatabaseCheckInPlayerItem["queueStatus"],
): "secondary" | "outline" | "destructive" {
  if (status === "on_court") return "secondary";
  if (status === "checked_out") return "outline";
  return "secondary";
}

async function fetchDatabaseCheckInPlayers(gameId: string, page: number, search: string) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (search) params.set("q", search);

  const response = await fetch(`/api/games/${gameId}/database-check-in?${params.toString()}`);
  const payload = (await response.json()) as DatabaseCheckInPlayersPage & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Failed to load players.");
  return payload;
}

type DatabaseCheckInDialogProps = {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DatabaseCheckInDialog({ gameId, open, onOpenChange }: DatabaseCheckInDialogProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
  }, [open, gameId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, searchInput]);

  const playersQuery = useQuery({
    queryKey: databaseCheckInQueryKey(gameId, page, searchQuery),
    queryFn: () => fetchDatabaseCheckInPlayers(gameId, page, searchQuery),
    enabled: open && Boolean(gameId),
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey;
      if (!previousKey) return undefined;
      return previousKey[2] === page && previousKey[3] === searchQuery ? previousData : undefined;
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const response = await fetch(`/api/games/${gameId}/database-check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to check in player.");
      return data;
    },
    onMutate: async (playerId: string) => {
      const queryKey = databaseCheckInQueryKey(gameId, page, searchQuery);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DatabaseCheckInPlayersPage>(queryKey);
      if (previous) {
        const nextTotal = Math.max(0, previous.total - 1);
        const nextTotalPages = nextTotal === 0 ? 0 : Math.ceil(nextTotal / PAGE_SIZE);

        queryClient.setQueryData<DatabaseCheckInPlayersPage>(queryKey, {
          ...previous,
          players: previous.players.filter((player) => player.id !== playerId),
          total: nextTotal,
          totalPages: nextTotalPages,
        });
      }

      return { previous, queryKey };
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Player added to queue.");
      void queryClient.invalidateQueries({ queryKey: operatorQueueQueryKey(gameId) });
      void queryClient.invalidateQueries({ queryKey: databaseCheckInPlayersQueryKey(gameId) });
    },
    onError: (error: Error, _playerId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toastOperationError(error, "Failed to check in player.");
    },
  });

  const handleCheckIn = (player: DatabaseCheckInPlayerItem) => {
    if (!player.canCheckIn) return;
    checkInMutation.mutate(player.id);
  };

  const totalPages = playersQuery.data?.totalPages ?? 0;
  const total = playersQuery.data?.total ?? 0;
  const showInitialLoading = playersQuery.isLoading && !playersQuery.data;
  const isRefreshing = playersQuery.isFetching && !showInitialLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="database-check-in-dialog flex max-h-[min(92dvh,52rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-3xl">
        <DialogHeader className="database-check-in-dialog-header shrink-0 border-b border-border px-5 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <DialogTitle className="database-check-in-dialog-title flex items-center gap-2.5">
            <UserPlus className="h-5 w-5 shrink-0 md:h-6 md:w-6" aria-hidden />
            Check in from database
          </DialogTitle>
          <DialogDescription className="database-check-in-dialog-description">
            Choose a player from your registration list to add them to this session queue.
          </DialogDescription>
        </DialogHeader>

        <div className="database-check-in-search shrink-0 border-b border-border px-5 py-3.5 sm:px-6 sm:py-4 md:px-8">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground md:h-5 md:w-5"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, or mobile"
              className="database-check-in-search-input h-11 pl-10 text-base md:h-12 md:pl-11 md:text-lg"
              aria-label="Search registered players"
              aria-busy={isRefreshing}
            />
            {isRefreshing ? (
              <Loader2
                className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground md:h-5 md:w-5"
                aria-hidden
              />
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "database-check-in-list min-h-0 flex-1 overflow-y-auto px-5 py-4 transition-opacity sm:px-6 md:px-8 md:py-5",
            isRefreshing && "opacity-70",
          )}
        >
          {showInitialLoading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-base text-muted-foreground md:text-lg">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading players…
            </div>
          ) : playersQuery.isError ? (
            shouldSuppressUserNotification(playersQuery.error) ? (
              <div className="flex items-center justify-center gap-2 py-14 text-base text-muted-foreground md:text-lg">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading players…
              </div>
            ) : (
              <p className="py-10 text-center text-base text-destructive md:text-lg">
                {getPublicErrorMessage(playersQuery.error, "Failed to load players.")}
              </p>
            )
          ) : playersQuery.data?.players.length === 0 ? (
            <p className="py-10 text-center text-base text-muted-foreground md:text-lg">
              {searchQuery
                ? "No available players match your search."
                : "No players available to check in."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5 md:gap-3">
              {playersQuery.data?.players.map((player) => {
                const statusLabel = queueStatusLabel(player.queueStatus);

                return (
                  <li
                    key={player.id}
                    className="database-check-in-row flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 md:gap-4 md:p-4"
                  >
                    <PlayerAvatar
                      player={{
                        _id: player.id,
                        firstName: player.firstName,
                        lastName: player.lastName,
                        photoUrl: player.photoUrl,
                        photoPublicId: player.photoPublicId,
                      }}
                      size="sm"
                      className="!size-10 shrink-0 md:!size-12"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold md:text-lg">{player.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {statusLabel ? (
                          <Badge
                            variant={queueStatusVariant(player.queueStatus)}
                            className="text-[11px] md:text-xs"
                          >
                            {statusLabel}
                          </Badge>
                        ) : null}
                        {player.isBlocked ? (
                          <Badge variant="destructive" className="text-[11px] md:text-xs">
                            Blocked
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      variant={player.canCheckIn ? "default" : "outline"}
                      className={cn(
                        "database-check-in-action shrink-0",
                        !player.canCheckIn && "pointer-events-none opacity-60",
                      )}
                      disabled={!player.canCheckIn}
                      onClick={() => handleCheckIn(player)}
                    >
                      {player.queueStatus === "checked_out" ? "Check back in" : "Check in"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="database-check-in-pagination flex shrink-0 items-center justify-between border-t border-border px-5 py-3.5 sm:px-6 md:px-8 md:py-4">
            <p className="text-sm text-muted-foreground md:text-base">
              Page {page} of {totalPages} · {total} players
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 md:h-11 md:w-11"
                disabled={page <= 1 || playersQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 md:h-11 md:w-11"
                disabled={page >= totalPages || playersQuery.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
