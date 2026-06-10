"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Clock, Loader2, MapPin, Search, Trash2, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Swal from "sweetalert2";

import { PlayerPhotoTrigger, PlayerProfileTrigger } from "@/components/game/player-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import {
  getMatchScoreInputError,
  MAX_MATCH_SCORE,
  sanitizeScoreInput,
} from "@/lib/match-score-validation";
import {
  formatMatchPlayedDuration,
  formatMatchTimeRange,
} from "@/lib/match-history-display";
import { filterMatchesByPlayerName } from "@/lib/match-history-filter";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type MatchHistoryPlayer = {
  _id?: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  personalQrCode?: string;
};

export type MatchHistoryView = {
  _id: string;
  courtNumber: number;
  teamAPlayerIds: MatchHistoryPlayer[];
  teamBPlayerIds: MatchHistoryPlayer[];
  winnerTeam: "A" | "B";
  teamAScore?: number | null;
  teamBScore?: number | null;
  startedAt?: string | null;
  durationSeconds: number;
  endedAt: string;
};

const MATCH_HISTORY_PAGE_SIZE = 5;

const deleteMatchAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

type EditMatchScoreInput = {
  matchId: string;
  teamAScore: number;
  teamBScore: number;
};

type GameMatchCachePayload = {
  matches: MatchHistoryView[];
};

/** Instant UI while the edit-score API request is in flight. */
function applyEditMatchScoreOptimistic(
  payload: GameMatchCachePayload,
  input: EditMatchScoreInput,
): GameMatchCachePayload | null {
  if (!payload.matches.some((match) => match._id === input.matchId)) return null;

  return {
    ...payload,
    matches: payload.matches.map((match) =>
      match._id === input.matchId
        ? { ...match, teamAScore: input.teamAScore, teamBScore: input.teamBScore }
        : match,
    ),
  };
}

function getInitials(firstName: string, lastName: string) {
  const first = firstName.trim()[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function TeamPanel({
  label,
  players,
  won,
}: {
  label: string;
  players: MatchHistoryPlayer[];
  won: boolean;
}) {
  return (
    <div
      className={cn(
        "match-history-team rounded-lg border p-2.5 transition-colors",
        won ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {won ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Trophy className="h-3 w-3" aria-hidden />
            Winner
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {players.length === 0 ? (
          <li className="text-sm text-muted-foreground">—</li>
        ) : (
          players.map((player, index) => {
            const name = formatPlayerDisplayName(player.firstName, player.lastName);
            return (
              <li key={player._id ?? `${name}-${index}`} className="flex items-center gap-2">
                <PlayerPhotoTrigger player={player} className="shrink-0 rounded-full">
                  <Avatar size="sm">
                    <AvatarImage src={resolvePlayerPhotoUrl(player)} alt={`${name} avatar`} />
                    <AvatarFallback>
                      {getInitials(player.firstName, player.lastName)}
                    </AvatarFallback>
                  </Avatar>
                </PlayerPhotoTrigger>
                <PlayerProfileTrigger player={player} className="min-w-0 flex-1">
                  <span className="min-w-0 truncate text-sm font-medium">{name}</span>
                </PlayerProfileTrigger>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function ScoreContent({
  match,
  teamAWon,
  hasScore,
}: {
  match: MatchHistoryView;
  teamAWon: boolean;
  hasScore: boolean;
}) {
  return (
    <>
      {hasScore ? (
        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-sm font-semibold tabular-nums">
          <span className={cn(teamAWon && "text-primary")}>{match.teamAScore ?? 0}</span>
          <span className="text-muted-foreground">–</span>
          <span className={cn(!teamAWon && "text-primary")}>{match.teamBScore ?? 0}</span>
        </span>
      ) : null}
      <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        VS
      </span>
    </>
  );
}

export type MatchHistoryScope = "mine" | "all";

type MatchHistoryScopeToggleProps = {
  scope: MatchHistoryScope;
  onScopeChange: (scope: MatchHistoryScope) => void;
};

export function MatchHistoryScopeToggle({
  scope,
  onScopeChange,
}: MatchHistoryScopeToggleProps) {
  return (
    <div
      className="match-history-scope-toggle inline-flex rounded-lg border border-border p-0.5"
      role="group"
      aria-label="Match history filter"
    >
      <Button
        type="button"
        size="sm"
        variant={scope === "mine" ? "default" : "ghost"}
        className={cn("h-8 px-2.5 text-xs", scope === "mine" && "shadow-sm")}
        aria-pressed={scope === "mine"}
        onClick={() => onScopeChange("mine")}
      >
        My matches
      </Button>
      <Button
        type="button"
        size="sm"
        variant={scope === "all" ? "default" : "ghost"}
        className={cn("h-8 px-2.5 text-xs", scope === "all" && "shadow-sm")}
        aria-pressed={scope === "all"}
        onClick={() => onScopeChange("all")}
      >
        All
      </Button>
    </div>
  );
}

export function MatchHistoryList({
  matches,
  gameId,
  editable = false,
  emptyMessage,
  showNameFilter = false,
}: {
  matches: MatchHistoryView[];
  gameId?: string;
  editable?: boolean;
  emptyMessage?: string;
  showNameFilter?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(MATCH_HISTORY_PAGE_SIZE);
  const [nameFilter, setNameFilter] = useState("");
  const prevMatchCount = useRef(matches.length);
  const queryClient = useQueryClient();

  const filteredMatches = useMemo(
    () => (showNameFilter ? filterMatchesByPlayerName(matches, nameFilter) : matches),
    [matches, nameFilter, showNameFilter],
  );

  const [editingMatch, setEditingMatch] = useState<MatchHistoryView | null>(null);
  const [editTeamAScore, setEditTeamAScore] = useState("");
  const [editTeamBScore, setEditTeamBScore] = useState("");

  const canEdit = editable && Boolean(gameId);

  const openEditScore = (match: MatchHistoryView) => {
    setEditingMatch(match);
    const a = Math.min(MAX_MATCH_SCORE, Math.max(0, match.teamAScore ?? 0));
    const b = Math.min(MAX_MATCH_SCORE, Math.max(0, match.teamBScore ?? 0));
    setEditTeamAScore(sanitizeScoreInput(String(a)));
    setEditTeamBScore(sanitizeScoreInput(String(b)));
  };

  const closeEditScore = () => {
    setEditingMatch(null);
    setEditTeamAScore("");
    setEditTeamBScore("");
  };

  const editScoreMutation = useMutation({
    mutationFn: async (input: EditMatchScoreInput) => {
      const response = await fetch(`/api/games/${gameId}/matches/${input.matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamAScore: input.teamAScore,
          teamBScore: input.teamBScore,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async (variables) => {
      if (!gameId) return { previous: undefined as GameMatchCachePayload | undefined };

      const gameQueryKey = ["game", gameId, "operator"] as const;
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = queryClient.getQueryData<GameMatchCachePayload>(gameQueryKey);
      if (!previous) return { previous: undefined as GameMatchCachePayload | undefined };

      const optimistic = applyEditMatchScoreOptimistic(previous, variables);
      if (!optimistic) return { previous };

      queryClient.setQueryData(gameQueryKey, optimistic);
      closeEditScore();
      return { previous, gameQueryKey };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      if (gameId) queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error, _variables, context) => {
      if (context?.previous && context.gameQueryKey) {
        queryClient.setQueryData(context.gameQueryKey, context.previous);
      }
      toast.error(error instanceof Error ? error.message : "Failed to update score.");
    },
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const response = await fetch(`/api/games/${gameId}/matches/${matchId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      if (gameId) queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
  });

  const confirmDeleteMatch = async (match: MatchHistoryView) => {
    const result = await Swal.fire({
      ...deleteMatchAlertOptions,
      title: "Delete match?",
      html: `Remove this Court ${match.courtNumber} match from history? Leaderboard stats for those players will be updated.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          return await deleteMatchMutation.mutateAsync(match._id);
        } catch (error) {
          Swal.showValidationMessage(
            error instanceof Error ? error.message : "Failed to delete match.",
          );
          return false;
        }
      },
    });

    if (!result.isConfirmed) return;
  };

  useEffect(() => {
    if (filteredMatches.length < prevMatchCount.current) {
      setVisibleCount(MATCH_HISTORY_PAGE_SIZE);
    }
    prevMatchCount.current = filteredMatches.length;
  }, [filteredMatches.length]);

  useEffect(() => {
    setVisibleCount(MATCH_HISTORY_PAGE_SIZE);
  }, [nameFilter]);

  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground">
        {emptyMessage ??
          "No matches yet. End a court game and pick the winning team to record a match."}
      </p>
    );
  }

  const visibleMatches = filteredMatches.slice(0, visibleCount);
  const remaining = filteredMatches.length - visibleCount;
  const hasMore = remaining > 0;
  const trimmedNameFilter = nameFilter.trim();

  const editScoreError = editingMatch
    ? getMatchScoreInputError(editingMatch.winnerTeam, editTeamAScore, editTeamBScore)
    : null;
  const editWinnerScoreRaw =
    editingMatch?.winnerTeam === "A" ? editTeamAScore : editTeamBScore;
  const editWinnerScoreParsed =
    editWinnerScoreRaw?.trim() === "" ? undefined : Number(editWinnerScoreRaw);
  const editLoserScoreMax =
    editWinnerScoreParsed !== undefined &&
    Number.isInteger(editWinnerScoreParsed) &&
    editWinnerScoreParsed >= 0
      ? Math.max(0, editWinnerScoreParsed - 1)
      : undefined;

  return (
    <div className="match-history-list space-y-2.5">
      {showNameFilter ? (
        <div className="match-history-name-filter relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Filter by player name"
            aria-label="Filter match history by player name"
            className="h-9 pr-9 pl-9"
          />
          {trimmedNameFilter ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label="Clear name filter"
              onClick={() => setNameFilter("")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ) : null}
      {filteredMatches.length === 0 ? (
        <p className="text-muted-foreground">
          No matches found for &ldquo;{trimmedNameFilter}&rdquo;.
        </p>
      ) : null}
      {visibleMatches.map((match) => {
        const teamAWon = match.winnerTeam === "A";
        const hasScore = match.teamAScore != null || match.teamBScore != null;
        return (
          <article
            key={match._id}
            className="match-history-item surface-muted rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm font-semibold">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                Court {match.courtNumber}
              </span>
              <p
                className="caption inline-flex max-w-full items-center justify-end gap-x-1.5 overflow-x-auto whitespace-nowrap text-right"
                suppressHydrationWarning
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium text-foreground">
                  {formatMatchPlayedDuration(match.durationSeconds)}
                </span>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-muted-foreground">{formatMatchTimeRange(match)}</span>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-muted-foreground">
                  Ended {formatDistanceToNow(new Date(match.endedAt), { addSuffix: true })}
                </span>
              </p>
            </div>
            <div className="mt-2.5 grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <TeamPanel label="Team A" players={match.teamAPlayerIds} won={teamAWon} />
              {canEdit ? (
                <SimpleTooltip label="Click to edit the score">
                  <button
                    type="button"
                    className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-1 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openEditScore(match)}
                  >
                    <ScoreContent match={match} teamAWon={teamAWon} hasScore={hasScore} />
                  </button>
                </SimpleTooltip>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                  <ScoreContent match={match} teamAWon={teamAWon} hasScore={hasScore} />
                </div>
              )}
              <TeamPanel label="Team B" players={match.teamBPlayerIds} won={!teamAWon} />
            </div>
            {canEdit ? (
              <div className="mt-2.5 flex justify-end border-t border-border/60 pt-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="match-history-delete-btn border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={
                    deleteMatchMutation.isPending &&
                    deleteMatchMutation.variables === match._id
                  }
                  onClick={() => void confirmDeleteMatch(match)}
                >
                  {deleteMatchMutation.isPending &&
                  deleteMatchMutation.variables === match._id ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            ) : null}
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

      <Dialog
        open={editingMatch !== null}
        onOpenChange={(open) => (!open ? closeEditScore() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMatch ? `Edit score · Court ${editingMatch.courtNumber}` : "Edit score"}
            </DialogTitle>
          </DialogHeader>
          {editingMatch ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="edit-team-a-score"
                    className={cn(
                      "text-sm font-medium",
                      editingMatch.winnerTeam === "A" && "text-primary",
                    )}
                  >
                    Team A
                    {editingMatch.winnerTeam === "A"
                      ? " (winner)"
                      : " (loser)"}
                  </label>
                  <Input
                    id="edit-team-a-score"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    min={0}
                    max={
                      editingMatch.winnerTeam === "A"
                        ? MAX_MATCH_SCORE
                        : editLoserScoreMax ?? MAX_MATCH_SCORE
                    }
                    value={editTeamAScore}
                    onChange={(event) =>
                      setEditTeamAScore(sanitizeScoreInput(event.target.value))
                    }
                    aria-invalid={editScoreError != null && editingMatch.winnerTeam === "B"}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="edit-team-b-score"
                    className={cn(
                      "text-sm font-medium",
                      editingMatch.winnerTeam === "B" && "text-primary",
                    )}
                  >
                    Team B
                    {editingMatch.winnerTeam === "B"
                      ? " (winner)"
                      : " (loser)"}
                  </label>
                  <Input
                    id="edit-team-b-score"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    min={0}
                    max={
                      editingMatch.winnerTeam === "B"
                        ? MAX_MATCH_SCORE
                        : editLoserScoreMax ?? MAX_MATCH_SCORE
                    }
                    value={editTeamBScore}
                    onChange={(event) =>
                      setEditTeamBScore(sanitizeScoreInput(event.target.value))
                    }
                    aria-invalid={editScoreError != null && editingMatch.winnerTeam === "A"}
                  />
                </div>
              </div>
              {editScoreError ? (
                <p className="text-sm text-destructive" role="alert">
                  {editScoreError}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" onClick={closeEditScore}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={editScoreError != null}
                  onClick={() => {
                    if (editScoreError || !editingMatch) return;
                    editScoreMutation.mutate({
                      matchId: editingMatch._id,
                      teamAScore: editTeamAScore.trim() === "" ? 0 : Number(editTeamAScore),
                      teamBScore: editTeamBScore.trim() === "" ? 0 : Number(editTeamBScore),
                    });
                  }}
                >
                  Save score
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
