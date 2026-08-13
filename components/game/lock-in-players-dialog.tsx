"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { operatorQueueQueryKey } from "@/lib/fetch-operator-game";
import { getPublicErrorMessage, shouldSuppressUserNotification } from "@/lib/infrastructure-error";
import {
  LOCK_IN_MAX_PLAYERS,
  LOCK_IN_MIN_PLAYERS,
  type LockInGroupItem,
} from "@/lib/lock-in-groups-shared";
import { toastOperationError } from "@/lib/toast-error";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type LockInCandidatePlayer = {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  statusLabel: "In queue" | "On court";
  lockInGroupId?: string | null;
};

type LockInGroupsResponse = {
  groups: LockInGroupItem[];
  message?: string;
};

function lockInGroupsQueryKey(gameId: string) {
  return ["lock-in-groups", gameId] as const;
}

async function fetchLockInGroups(gameId: string) {
  const response = await fetch(`/api/games/${gameId}/lock-in-groups`);
  const payload = (await response.json()) as LockInGroupsResponse;
  if (!response.ok) throw new Error(payload.message ?? "Failed to load lock-in groups.");
  return payload;
}

type LockInPlayersDialogProps = {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: LockInCandidatePlayer[];
};

export function LockInPlayersDialog({
  gameId,
  open,
  onOpenChange,
  candidates,
}: LockInPlayersDialogProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setSearchInput("");
    setSelectedIds([]);
  }, [open, gameId]);

  const groupsQuery = useQuery({
    queryKey: lockInGroupsQueryKey(gameId),
    queryFn: () => fetchLockInGroups(gameId),
    enabled: open,
  });

  const invalidateQueue = async () => {
    await queryClient.invalidateQueries({ queryKey: operatorQueueQueryKey(gameId) });
    await queryClient.invalidateQueries({ queryKey: lockInGroupsQueryKey(gameId) });
  };

  const createMutation = useMutation({
    mutationFn: async (playerIds: string[]) => {
      const response = await fetch(`/api/games/${gameId}/lock-in-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds }),
      });
      const payload = (await response.json()) as LockInGroupsResponse & { groupId?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to create lock-in group.");
      return payload;
    },
    onSuccess: async (payload) => {
      toast.success(payload.message ?? "Lock-in group created.");
      await invalidateQueue();
      onOpenChange(false);
    },
    onError: (error) => {
      if (shouldSuppressUserNotification(error)) return;
      toastOperationError(error, getPublicErrorMessage(error, "Failed to create lock-in group."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/games/${gameId}/lock-in-groups/${groupId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as LockInGroupsResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to remove lock-in group.");
      return payload;
    },
    onSuccess: async (payload) => {
      toast.success(payload.message ?? "Lock-in group removed.");
      await invalidateQueue();
    },
    onError: (error) => {
      if (shouldSuppressUserNotification(error)) return;
      toastOperationError(error, getPublicErrorMessage(error, "Failed to remove lock-in group."));
    },
  });

  const groups = groupsQuery.data?.groups ?? [];

  const lockedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const playerId of group.playerIds) ids.add(playerId);
    }
    return ids;
  }, [groups]);

  const search = searchInput.trim().toLowerCase();
  const availableCandidates = useMemo(() => {
    return candidates.filter((player) => {
      if (player.lockInGroupId || lockedPlayerIds.has(player.id)) return false;
      if (!search) return true;
      const name = `${player.firstName} ${player.lastName}`.trim().toLowerCase();
      return name.includes(search);
    });
  }, [candidates, lockedPlayerIds, search]);

  const selectedPlayers = useMemo(() => {
    const byId = new Map(candidates.map((player) => [player.id, player]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((player): player is LockInCandidatePlayer => player != null);
  }, [candidates, selectedIds]);

  const canSave =
    selectedIds.length >= LOCK_IN_MIN_PLAYERS &&
    selectedIds.length <= LOCK_IN_MAX_PLAYERS &&
    !createMutation.isPending;

  const togglePlayer = (playerId: string) => {
    setSelectedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= LOCK_IN_MAX_PLAYERS) {
        toast.message(`Select up to ${LOCK_IN_MAX_PLAYERS} players.`);
        return current;
      }
      return [...current, playerId];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="flex items-center gap-2.5">
            <Lock className="h-5 w-5" aria-hidden />
            Lock-in Players
          </DialogTitle>
          <DialogDescription>
            Keep 2–4 players adjacent in the queue. Dragging one moves the whole group.
          </DialogDescription>
        </DialogHeader>

        {!creating ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border px-5 py-3.5 sm:px-6">
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  setCreating(true);
                  setSelectedIds([]);
                  setSearchInput("");
                }}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Create Group
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {groupsQuery.isLoading ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading groups…
                </p>
              ) : groups.length === 0 ? (
                <p className="text-muted-foreground">No lock-in groups yet.</p>
              ) : (
                <ul className="space-y-3">
                  {groups.map((group) => (
                    <li
                      key={group.groupId}
                      className="rounded-xl border border-border bg-card p-3.5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          Group · {group.players.length} players
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(group.groupId)}
                          aria-label="Remove lock-in group"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      <ul className="space-y-2">
                        {group.players.map((player) => (
                          <li key={player.id} className="flex items-center gap-2.5">
                            <PlayerAvatar
                              player={{
                                _id: player.id,
                                firstName: player.firstName,
                                lastName: player.lastName,
                                photoUrl: player.photoUrl,
                                photoPublicId: player.photoPublicId,
                              }}
                              size="sm"
                              className="!size-8 shrink-0"
                            />
                            <span className="min-w-0 truncate text-sm">
                              {formatPlayerDisplayName(player.firstName, player.lastName)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 space-y-3 border-b border-border px-5 py-3.5 sm:px-6">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by first or last name"
                  className="h-11 pl-10 text-base"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {selectedIds.length} / {LOCK_IN_MAX_PLAYERS} selected
                </Badge>
                {selectedPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                    onClick={() => togglePlayer(player.id)}
                  >
                    {formatPlayerDisplayName(player.firstName, player.lastName)}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {availableCandidates.length === 0 ? (
                <p className="text-muted-foreground">
                  {search
                    ? "No matching players available."
                    : "No available players in queue or on court."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {availableCandidates.map((player) => {
                    const selected = selectedIds.includes(player.id);
                    const displayName = formatPlayerDisplayName(
                      player.firstName,
                      player.lastName,
                    );
                    return (
                      <li key={player.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          aria-label={`${selected ? "Deselect" : "Select"} ${displayName}`}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:bg-muted/40",
                          )}
                          onClick={() => togglePlayer(player.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              togglePlayer(player.id);
                            }
                          }}
                        >
                          <span
                            className="shrink-0"
                            onClick={(event) => event.stopPropagation()}
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
                              className="!size-10 shrink-0"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{displayName}</span>
                            <span className="caption text-muted-foreground">
                              {player.statusLabel}
                            </span>
                          </span>
                          {selected ? (
                            <Badge>Selected</Badge>
                          ) : (
                            <Badge variant="outline">Select</Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setCreating(false);
                  setSelectedIds([]);
                  setSearchInput("");
                }}
                disabled={createMutation.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={!canSave}
                onClick={() => createMutation.mutate(selectedIds)}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
