"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getPublicErrorMessage, shouldSuppressUserNotification } from "@/lib/infrastructure-error";
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
  const [checkingInPlayerId, setCheckingInPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
    setCheckingInPlayerId(null);
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
    staleTime: 10_000,
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
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Player added to queue.");
      void queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      void queryClient.invalidateQueries({ queryKey: ["database-check-in-players", gameId] });
    },
    onError: (error: Error) => {
      toastOperationError(error, "Failed to check in player.");
    },
    onSettled: () => {
      setCheckingInPlayerId(null);
    },
  });

  const handleCheckIn = (player: DatabaseCheckInPlayerItem) => {
    if (!player.canCheckIn || checkInMutation.isPending) return;
    setCheckingInPlayerId(player.id);
    checkInMutation.mutate(player.id);
  };

  const totalPages = playersQuery.data?.totalPages ?? 0;
  const total = playersQuery.data?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="database-check-in-dialog flex max-h-[min(92dvh,40rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
            Check in from database
          </DialogTitle>
          <DialogDescription>
            Choose a player from your registration list to add them to this session queue.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, or mobile"
              className="pl-9"
              aria-label="Search registered players"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {playersQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading players…
            </div>
          ) : playersQuery.isError ? (
            shouldSuppressUserNotification(playersQuery.error) ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading players…
              </div>
            ) : (
            <p className="py-8 text-center text-sm text-destructive">
              {getPublicErrorMessage(playersQuery.error, "Failed to load players.")}
            </p>
            )
          ) : playersQuery.data?.players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery
                ? "No available players match your search."
                : "No players available to check in."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {playersQuery.data?.players.map((player) => {
                const statusLabel = queueStatusLabel(player.queueStatus);
                const isCheckingIn = checkingInPlayerId === player.id;

                return (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
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
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{player.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {statusLabel ? (
                          <Badge variant={queueStatusVariant(player.queueStatus)} className="text-[10px]">
                            {statusLabel}
                          </Badge>
                        ) : null}
                        {player.isBlocked ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Blocked
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={player.canCheckIn ? "default" : "outline"}
                      className={cn("shrink-0", !player.canCheckIn && "pointer-events-none opacity-60")}
                      disabled={!player.canCheckIn || isCheckingIn}
                      onClick={() => handleCheckIn(player)}
                    >
                      {isCheckingIn ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                          Adding…
                        </>
                      ) : player.queueStatus === "checked_out" ? (
                        "Check back in"
                      ) : (
                        "Check in"
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} players
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={page <= 1 || playersQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={page >= totalPages || playersQuery.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
