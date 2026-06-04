"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  QrCode,
  Play,
  RotateCcw,
  House,
  Flag,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { PlayerAvatar, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { promptIfRegistrationFull } from "@/components/game/registration-capacity-prompt";
import { MatchHistoryList, type MatchHistoryView } from "@/components/game/match-history-list";
import { FillCourtConfirmDialog } from "@/components/game/fill-court-confirm-dialog";
import {
  ReplacePlayerDialog,
  type ReplacePlayerConfirmInput,
  type ReplacePlayerDialogState,
} from "@/components/game/replace-player-dialog";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import {
  QueueDndZone,
  QueueDragHandle,
  SortableQueueItem,
  SortableQueueList,
} from "@/components/game/sortable-queue-list";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerSessionStatsMap,
  type LeaderboardGamesPlayedRow,
} from "@/lib/games-played-map";
import type { GameLeaderboardRecapRow } from "@/lib/game-leaderboard-recap";
import type { SessionInsight } from "@/lib/session-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isDemoOpenPlayTitle } from "@/lib/demo-open-play";
import { isGameResetEnabled } from "@/lib/feature-flags";
import {
  clearQueueHighlightPlayerId,
  getActiveQueueHighlightPlayerId,
  getActiveQueueHighlightPlayerIds,
  hasQueueHighlightBeenApplied,
  markQueueHighlightApplied,
  peekQueueHighlightPlayerId,
  persistActiveQueueHighlight,
  queueEntryPlayerId,
  removeActiveQueueHighlightPlayerId,
} from "@/lib/queue-highlight";
import {
  getMatchScoreInputError,
  MAX_MATCH_SCORE,
  sanitizeScoreInput,
} from "@/lib/match-score-validation";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type GameDashboardMode = "operator" | "spectator";

type GamePayload = {
  game: {
    title: string;
    openPlayType: string;
    courtCount: number;
    gameId: string;
    status: "draft" | "active" | "ended";
    registerUrl?: string;
    publicQrCodeDataUrl?: string;
  };
  queue: QueueEntryView[];
  checkedOut?: QueueEntryView[];
  courts: CourtView[];
  leaderboard?: LeaderboardGamesPlayedRow[];
  matches: MatchHistoryView[];
  recap?: {
    rows: GameLeaderboardRecapRow[];
    insights: SessionInsight[];
  };
};

const alertBaseOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#ef4444",
};

const WAITING_LIST_STORAGE_KEY = "ccf-queue-waiting-visible";
const CHECKED_OUT_LIST_STORAGE_KEY = "ccf-queue-checked-out-visible";
const MATCH_HISTORY_STORAGE_KEY = "ccf-match-history-visible";
const COURTS_STORAGE_KEY = "ccf-courts-visible";
const CHECKED_OUT_PREVIEW_COUNT = 2;

function loadShowWaitingList() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(WAITING_LIST_STORAGE_KEY) !== "false";
}

function saveShowWaitingList(show: boolean) {
  localStorage.setItem(WAITING_LIST_STORAGE_KEY, show ? "true" : "false");
}

function loadShowCheckedOutList() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(CHECKED_OUT_LIST_STORAGE_KEY) !== "false";
}

function saveShowCheckedOutList(show: boolean) {
  localStorage.setItem(CHECKED_OUT_LIST_STORAGE_KEY, show ? "true" : "false");
}

function loadShowMatchHistory() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MATCH_HISTORY_STORAGE_KEY) !== "false";
}

function saveShowMatchHistory(show: boolean) {
  localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, show ? "true" : "false");
}

function loadShowCourts() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(COURTS_STORAGE_KEY) !== "false";
}

function saveShowCourts(show: boolean) {
  localStorage.setItem(COURTS_STORAGE_KEY, show ? "true" : "false");
}

type QueueCheckedOutListProps = {
  entries: QueueEntryView[];
  expanded: boolean;
  onToggle: () => void;
  onCheckBackIn: (entry: QueueEntryView) => void;
  checkBackInPendingId: string | null;
};

function QueueCheckedOutList({
  entries,
  expanded,
  onToggle,
  onCheckBackIn,
  checkBackInPendingId,
}: QueueCheckedOutListProps) {
  const [showAllCheckedOut, setShowAllCheckedOut] = useState(false);

  useEffect(() => {
    if (!expanded) setShowAllCheckedOut(false);
  }, [expanded]);

  const countLabel = entries.length > 0 ? ` (${entries.length})` : "";
  const hasMoreThanPreview = entries.length > CHECKED_OUT_PREVIEW_COUNT;
  const visibleEntries =
    showAllCheckedOut || !hasMoreThanPreview
      ? entries
      : entries.slice(0, CHECKED_OUT_PREVIEW_COUNT);
  const hiddenCount = entries.length - CHECKED_OUT_PREVIEW_COUNT;

  return (
    <div className="queue-checked-out-group mt-3 space-y-2">
      <div className="queue-checked-out-header">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="queue-checked-out-toggle mb-2"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="queue-checked-out-list"
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1.5 h-4 w-4" />
              Hide checked out{countLabel}
            </>
          ) : (
            <>
              <ChevronDown className="mr-1.5 h-4 w-4" />
              Show checked out{countLabel}
            </>
          )}
        </Button>
        <div className="queue-divider" role="separator">
          <span>Checked out</span>
        </div>
      </div>
      {expanded ? (
        entries.length === 0 ? (
          <p className="caption px-1 text-muted-foreground">No players have checked out yet.</p>
        ) : (
          <>
            <div id="queue-checked-out-list" className="space-y-2">
              {visibleEntries.map((entry, index) => (
                <QueueEntryRow
                  key={entry._id}
                  entry={{
                    ...entry,
                    checkedOutAt: entry.checkedOutAt ?? entry.updatedAt,
                  }}
                  index={index}
                  isNextUp={false}
                  canReplace={false}
                  onReplace={() => {}}
                  replacePending={false}
                  hideReplacePanel
                  checkedOut
                  onCheckBackIn={() => onCheckBackIn(entry)}
                  checkBackInPending={checkBackInPendingId === entry._id}
                />
              ))}
            </div>
            {hasMoreThanPreview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="queue-checked-out-show-all w-full"
                onClick={() => setShowAllCheckedOut((prev) => !prev)}
                aria-expanded={showAllCheckedOut}
              >
                {showAllCheckedOut ? (
                  <>
                    <ChevronUp className="mr-1.5 h-4 w-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1.5 h-4 w-4" />
                    Show all ({hiddenCount} more)
                  </>
                )}
              </Button>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}

function CourtWinnerTeamRoster({ players }: { players: PlayerPhotoRef[] }) {
  if (players.length === 0) {
    return <p className="court-winner-team-roster text-center text-xs text-muted-foreground">—</p>;
  }

  return (
    <ul className="court-winner-team-roster flex flex-col gap-1.5">
      {players.map((player, index) => (
        <li
          key={
            player._id != null
              ? `${String(player._id)}-${index}`
              : `${player.firstName}-${player.lastName}-${index}`
          }
          className="flex items-center gap-2"
        >
          <PlayerAvatar player={player} size="sm" className="!size-8 sm:!size-8" />
          <span className="min-w-0 text-left text-xs font-medium leading-snug">
            {formatPlayerDisplayName(player.firstName, player.lastName)}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function getGame(id: string, spectator: boolean) {
  const path = spectator ? `/api/games/${id}/spectate` : `/api/games/${id}`;
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
}

type GameDashboardProps = {
  mode?: GameDashboardMode;
};

export function GameDashboard({ mode = "operator" }: GameDashboardProps) {
  const isSpectator = mode === "spectator";
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params.id ?? "";
  const queryClient = useQueryClient();
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [pendingWinner, setPendingWinner] = useState<"A" | "B" | null>(null);
  const [endGameRematch, setEndGameRematch] = useState(false);
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");
  const [showWaitingList, setShowWaitingList] = useState(true);
  const [showCheckedOutList, setShowCheckedOutList] = useState(true);
  const [showMatchHistory, setShowMatchHistory] = useState(true);
  const [showCourts, setShowCourts] = useState(true);
  const [replaceDialog, setReplaceDialog] = useState<ReplacePlayerDialogState | null>(null);
  const [fillCourtDialogOpen, setFillCourtDialogOpen] = useState(false);
  const [cancelCourtTarget, setCancelCourtTarget] = useState<number | null>(null);
  const [cancelRematchTarget, setCancelRematchTarget] = useState<number | null>(null);
  const [rematchCourtNumbers, setRematchCourtNumbers] = useState<Set<number>>(
    () => new Set(),
  );
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogLoading, setQrDialogLoading] = useState(false);
  const openQrRegistrationDialog = async () => {
    setQrDialogLoading(true);
    try {
      const canProceed = await promptIfRegistrationFull(gameId);
      if (canProceed) {
        setQrDialogOpen(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check registration status.");
    } finally {
      setQrDialogLoading(false);
    }
  };

  useEffect(() => {
    setShowWaitingList(loadShowWaitingList());
    setShowCheckedOutList(loadShowCheckedOutList());
    setShowMatchHistory(loadShowMatchHistory());
    setShowCourts(loadShowCourts());
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["game", gameId, isSpectator ? "spectator" : "operator"],
    queryFn: () => getGame(gameId, isSpectator) as Promise<GamePayload>,
    enabled: !!gameId,
    refetchInterval: (query) => {
      const status = query.state.data?.game?.status;
      if (isSpectator && status === "ended") return false;
      return 4000;
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Next court filled from the queue.");
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const closeEndDialog = () => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  };

  const endMutation = useMutation({
    mutationFn: async (input: {
      courtNumber: number;
      winnerTeam: "A" | "B";
      teamAScore: number;
      teamBScore: number;
      rematch: boolean;
    }) => {
      const response = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message?: string; rematch?: boolean };
    },
    onSuccess: (data, variables) => {
      if (variables.rematch) {
        setRematchCourtNumbers((prev) => new Set(prev).add(variables.courtNumber));
      } else {
        setRematchCourtNumbers((prev) => {
          const next = new Set(prev);
          next.delete(variables.courtNumber);
          return next;
        });
      }
      closeEndDialog();
      toast.success(data.message ?? "Court updated.");
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const shuffleNextMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/shuffle-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const swapCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      const response = await fetch(`/api/games/${gameId}/swap-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      const response = await fetch(`/api/games/${gameId}/cancel-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data, courtNumber) => {
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      toast.success(data.message);
      setCancelCourtTarget(null);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelRematchMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      const response = await fetch(`/api/games/${gameId}/cancel-rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data, courtNumber) => {
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      toast.success(data.message);
      setCancelRematchTarget(null);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/reset`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const endOpenPlayMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/end-open-play`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: async (payload) => {
      toast.success(payload.message);
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      router.replace("/");
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderQueueMutation = useMutation({
    mutationFn: async (orderedEntryIds: string[]) => {
      const response = await fetch(`/api/games/${gameId}/reorder-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedEntryIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const replaceMutation = useMutation({
    mutationFn: async (input: { sourceIndex: number; targetIndex: number }) => {
      const response = await fetch(`/api/games/${gameId}/swap-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      setReplaceDialog(null);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const replaceCourtMutation = useMutation({
    mutationFn: async (input: {
      courtNumber: number;
      team: "A" | "B";
      slotIndex: number;
      targetIndex: number;
    }) => {
      const response = await fetch(`/api/games/${gameId}/replace-court-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      setReplaceDialog(null);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleReplaceConfirm = (input: ReplacePlayerConfirmInput) => {
    if (input.kind === "queue") {
      replaceMutation.mutate({
        sourceIndex: input.sourceIndex,
        targetIndex: input.targetIndex,
      });
      return;
    }
    replaceCourtMutation.mutate({
      courtNumber: input.courtNumber,
      team: input.team,
      slotIndex: input.slotIndex,
      targetIndex: input.targetIndex,
    });
  };

  const courtReplacePendingKey =
    replaceCourtMutation.isPending && replaceCourtMutation.variables
      ? `${replaceCourtMutation.variables.courtNumber}-${replaceCourtMutation.variables.team}-${replaceCourtMutation.variables.slotIndex}`
      : null;

  const removeMutation = useMutation({
    mutationFn: async (input: {
      queueEntryId: string;
      checkedOutPlayerId: string;
      selfPlayerIds?: string[];
    }) => {
      const response = await fetch(`/api/games/${gameId}/remove-from-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (payload, variables) => {
      if (gameId) {
        removeActiveQueueHighlightPlayerId(gameId, variables.checkedOutPlayerId);
      }
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const checkBackInMutation = useMutation({
    mutationFn: async (queueEntryId: string) => {
      const response = await fetch(`/api/games/${gameId}/check-back-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueEntryId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const confirmRemoveFromQueue = async (entry: QueueEntryView) => {
    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );
    const result = await Swal.fire({
      ...alertBaseOptions,
      title: "Check out?",
      html: `<strong>${playerName}</strong> will be checked out of the queue. Their registration and match history are kept.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, check out",
      cancelButtonText: "Cancel",
    });
    if (result.isConfirmed) {
      removeMutation.mutate({
        queueEntryId: entry._id,
        checkedOutPlayerId: queueEntryPlayerId(entry),
        selfPlayerIds,
      });
    }
  };

  const playerSessionStats = useMemo(
    () => buildPlayerSessionStatsMap(data?.leaderboard),
    [data?.leaderboard],
  );
  const queueWithStats = useMemo(
    () =>
      (data?.queue ?? []).map((entry) =>
        attachSessionStatsToQueueEntry(entry, playerSessionStats),
      ),
    [data?.queue, playerSessionStats],
  );
  const checkedOutWithStats = useMemo(
    () =>
      (data?.checkedOut ?? []).map((entry) =>
        attachSessionStatsToQueueEntry(entry, playerSessionStats),
      ),
    [data?.checkedOut, playerSessionStats],
  );
  const waitingLineEntries = useMemo(() => queueWithStats.slice(4), [queueWithStats]);

  /** Re-read on every queue update so highlight never drops after refetch or reorder. */
  const selfHighlightPlayerId = useMemo(
    () => (gameId ? getActiveQueueHighlightPlayerId(gameId) : null),
    [gameId, data?.queue],
  );
  const selfPlayerIds = useMemo(
    () => (gameId ? getActiveQueueHighlightPlayerIds(gameId) : []),
    [gameId, data?.queue],
  );

  useEffect(() => {
    if (!data?.courts) return;
    setRematchCourtNumbers(
      new Set(
        data.courts
          .filter((court) => court.status === "active" && court.isRematch === true)
          .map((court) => court.courtNumber),
      ),
    );
  }, [data?.courts]);

  useEffect(() => {
    if (!gameId || !data?.queue?.length) return;

    const fromRegistration = peekQueueHighlightPlayerId(gameId);
    if (!fromRegistration) return;

    const queueIndex = data.queue.findIndex(
      (entry) => queueEntryPlayerId(entry) === fromRegistration,
    );
    if (queueIndex < 0) return;

    markQueueHighlightApplied(gameId);
    clearQueueHighlightPlayerId(gameId);
    persistActiveQueueHighlight(gameId, fromRegistration);

    if (queueIndex >= 4) {
      setShowWaitingList(true);
      saveShowWaitingList(true);
    }

    const entry = data.queue[queueIndex];
    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`queue-entry-${entry._id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [gameId, data?.queue]);

  const readOnly = isSpectator;
  const loadingLabel = isSpectator ? "Loading spectator view..." : "Loading game dashboard...";

  if (isLoading) {
    return <div className="p-8 text-base text-muted-foreground">{loadingLabel}</div>;
  }
  if (error) {
    return (
      <div className="p-8 text-destructive">
        Failed to load game data: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }
  if (!data) return <div className="p-8">No game data.</div>;

  const { game, courts, matches, recap } = data;

  const isCourtRematch = (court: CourtView) =>
    court.isRematch === true || rematchCourtNumbers.has(court.courtNumber);

  const playersOnCourtsCount = courts.reduce((total, court) => {
    if (court.status !== "active") return total;
    return (
      total +
      (court.teamA?.playerIds?.length ?? 0) +
      (court.teamB?.playerIds?.length ?? 0)
    );
  }, 0);
  const totalSessionPlayers = queueWithStats.length + playersOnCourtsCount;
  const isPastGame = game.status === "ended";
  const showSpectatorEndedRecap = isSpectator && isPastGame;
  const canResetGame = isDemoOpenPlayTitle(game.title) || isGameResetEnabled();
  const hideControls = readOnly || isPastGame;
  const canReorderQueue =
    !hideControls && queueWithStats.length >= 2 && !reorderQueueMutation.isPending;
  const queueEntryIds = queueWithStats.map((entry) => entry._id);
  const canCheckoutFromQueue = !isPastGame;

  const renderQueuedEntry = (entry: QueueEntryView, index: number) => {
    const isNextUp = index < 4;
    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );

    return (
      <SortableQueueItem key={entry._id} id={entry._id} enabled={canReorderQueue}>
        {(drag) => (
          <QueueEntryRow
            entry={entry}
            index={index}
            isNextUp={isNextUp}
            inWaitingLine={!isNextUp}
            canReplace={!hideControls && isNextUp && waitingLineEntries.length > 0}
            onReplace={
              hideControls
                ? () => {}
                : () =>
                    setReplaceDialog({
                      kind: "queue",
                      sourceIndex: index,
                      sourceEntry: entry,
                    })
            }
            replacePending={
              !hideControls &&
              replaceMutation.isPending &&
              replaceMutation.variables?.sourceIndex === index
            }
            hideReplacePanel={hideControls}
            onRemove={
              canRemoveEntry(entry) ? () => confirmRemoveFromQueue(entry) : undefined
            }
            removePending={
              canRemoveEntry(entry) &&
              removeMutation.isPending &&
              removeMutation.variables?.queueEntryId === entry._id
            }
            highlighted={
              selfHighlightPlayerId != null &&
              queueEntryPlayerId(entry) === selfHighlightPlayerId
            }
            dragHandle={
              drag ? (
                <QueueDragHandle
                  {...drag}
                  label={`Reorder ${playerName} in queue`}
                />
              ) : undefined
            }
          />
        )}
      </SortableQueueItem>
    );
  };
  const canSelfCheckoutEntry = (entry: QueueEntryView) =>
    selfPlayerIds.includes(queueEntryPlayerId(entry));
  const canRemoveEntry = (entry: QueueEntryView) =>
    !hideControls || (isSpectator && canCheckoutFromQueue && canSelfCheckoutEntry(entry));
  const nextEmptyCourt =
    [...courts]
      .filter((c) => c.status === "empty")
      .sort((a, b) => a.courtNumber - b.courtNumber)[0] ?? null;
  const canFillNextCourt = queueWithStats.length >= 4 && nextEmptyCourt != null;
  const fillCourtTeamA = queueWithStats.slice(0, 2);
  const fillCourtTeamB = queueWithStats.slice(2, 4);
  const fillingCourtNumber = startMutation.isPending ? nextEmptyCourt?.courtNumber ?? null : null;
  const endCourt =
    endTargetCourt != null ? courts.find((c) => c.courtNumber === endTargetCourt) : undefined;
  const winningPlayers =
    pendingWinner === "A"
      ? (endCourt?.teamA.playerIds ?? [])
      : pendingWinner === "B"
        ? (endCourt?.teamB.playerIds ?? [])
        : [];
  const endGameScoreError =
    pendingWinner != null
      ? getMatchScoreInputError(pendingWinner, teamAScore, teamBScore, { required: true })
      : null;
  const endGameWinnerScoreRaw = pendingWinner === "A" ? teamAScore : teamBScore;
  const endGameWinnerScoreParsed =
    endGameWinnerScoreRaw.trim() === "" ? undefined : Number(endGameWinnerScoreRaw);
  const endGameLoserScoreMax =
    endGameWinnerScoreParsed !== undefined &&
    Number.isInteger(endGameWinnerScoreParsed) &&
    endGameWinnerScoreParsed >= 0
      ? Math.max(0, endGameWinnerScoreParsed - 1)
      : undefined;

  return (
    <main
      className={cn(
        "relative min-h-screen p-4 md:p-6",
        isSpectator && "game-dashboard--spectator",
      )}
    >
      {endOpenPlayMutation.isPending ? (
        <div
          className="game-end-open-play-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-base font-medium text-foreground">Ending open play…</p>
          <p className="caption text-muted-foreground">Returning to your game list.</p>
        </div>
      ) : null}
      <section className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <Card className="glass-panel game-dashboard-header">
          <CardContent className="game-dashboard-header-content p-4">
            <div className="game-dashboard-header-top">
              <div className="min-w-0">
                <h1 className="page-title">{game.title}</h1>
                {isSpectator ? (
                  <p className="caption mt-1 text-muted-foreground">
                    {showSpectatorEndedRecap
                      ? "Session ended — view awards, standings, and match history below"
                      : "View only — live queue and courts update automatically"}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {isSpectator ? (
                    <Badge variant="secondary" className="spectator-badge">
                      Spectator view
                    </Badge>
                  ) : null}
                  <Badge>{game.openPlayType}</Badge>
                  <Badge variant="outline">Courts: {game.courtCount}</Badge>
                  <Badge variant="outline">
                    Players: {totalSessionPlayers}
                  </Badge>
                  <Badge variant={game.status === "ended" ? "destructive" : "outline"}>
                    Status: {game.status}
                  </Badge>
                </div>
              </div>
            </div>
            {!showSpectatorEndedRecap ? (
            <div className="game-toolbar mt-4 flex flex-wrap items-center gap-2">
              {!isSpectator ? (
                <Link href="/">
                  <Button size="lg" variant="outline">
                    <House className="mr-2 h-4 w-4" /> Home
                  </Button>
                </Link>
              ) : null}
              {!readOnly && !isPastGame && game.publicQrCodeDataUrl && game.registerUrl ? (
                <Button
                  size="lg"
                  variant="outline"
                  disabled={qrDialogLoading}
                  onClick={openQrRegistrationDialog}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {qrDialogLoading ? "Checking…" : "QR Registration"}
                </Button>
              ) : null}
              {!showSpectatorEndedRecap ? (
                <Link
                  href={
                    isSpectator
                      ? `/leaderboard/${game.gameId}?from=spectator`
                      : `/leaderboard/${game.gameId}`
                  }
                >
                  <Button size="lg" variant="outline">
                    <Trophy className="mr-2 h-4 w-4" /> Leaderboard
                  </Button>
                </Link>
              ) : null}
              {!readOnly && !isPastGame ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-destructive/50 text-destructive"
                  onClick={async () => {
                    const result = await Swal.fire({
                      ...alertBaseOptions,
                      title: "End Open Play?",
                      text: "This will mark this game as ended.",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, end it",
                      cancelButtonText: "Cancel",
                    });
                    if (result.isConfirmed) endOpenPlayMutation.mutate();
                  }}
                  disabled={endOpenPlayMutation.isPending}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  {endOpenPlayMutation.isPending ? "Ending..." : "End Open Play"}
                </Button>
              ) : null}
              {!readOnly && canResetGame ? (
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={async () => {
                    const result = await Swal.fire({
                      ...alertBaseOptions,
                      title: "Reset Game?",
                      text: "This clears matches and the leaderboard, then rebuilds the queue.",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Yes, reset",
                      cancelButtonText: "Cancel",
                    });
                    if (result.isConfirmed) resetMutation.mutate();
                  }}
                  disabled={resetMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {resetMutation.isPending ? "Resetting..." : "Reset"}
                </Button>
              ) : null}
            </div>
            ) : null}
          </CardContent>
        </Card>

        {showSpectatorEndedRecap ? (
          <LeaderboardPageContent
            insights={recap?.insights ?? []}
            rows={recap?.rows ?? []}
          />
        ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Queue</CardTitle>
              {!hideControls ? (
                <Button
                  onClick={() => {
                    if (!canFillNextCourt) {
                      if (queueWithStats.length < 4) {
                        toast.error("Not enough players in the queue. At least 4 are required.");
                      } else {
                        toast.error("No empty court available.");
                      }
                      return;
                    }
                    setFillCourtDialogOpen(true);
                  }}
                  disabled={startMutation.isPending || !canFillNextCourt}
                >
                  {startMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Filling…
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" aria-hidden />
                      Fill next court
                    </>
                  )}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="queue-list">
              {queueWithStats.length === 0 && checkedOutWithStats.length === 0 ? (
                <p className="text-muted-foreground">Queue is empty.</p>
              ) : (
                <>
                  {queueWithStats.length > 0 ? (
                    <SortableQueueList
                      entryIds={queueEntryIds}
                      enabled={canReorderQueue}
                      onReorder={(orderedEntryIds) =>
                        reorderQueueMutation.mutate(orderedEntryIds)
                      }
                    >
                      <QueueDndZone zone="next-up" className="queue-next-up-group">
                        <div className="queue-next-up-banner">
                          <div className="flex items-center gap-2">
                            <span className="queue-next-up-icon">
                              <Zap className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="queue-next-up-title">
                                <span className="xl:hidden">Next</span>
                                <span className="hidden xl:inline">Next on court</span>
                              </p>
                              <p className="caption hidden xl:block">
                                Top {Math.min(4, queueWithStats.length)}{" "}
                                {Math.min(4, queueWithStats.length) === 1 ? "player" : "players"} — ready to play
                                {canReorderQueue ? " · drag to reorder" : ""}
                              </p>
                            </div>
                          </div>
                          <Badge className="badge-next-up-count">
                            {Math.min(4, queueWithStats.length)} / 4
                          </Badge>
                        </div>
                        <div className="queue-next-up-slots">
                          {queueWithStats.slice(0, 4).map((entry, index) =>
                            renderQueuedEntry(entry, index),
                          )}
                        </div>
                      </QueueDndZone>
                      {queueWithStats.length > 4 ? (
                        <QueueDndZone zone="waiting" className="queue-waiting-group">
                          <div className="queue-waiting-header">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="queue-waiting-toggle mb-2"
                              onClick={() => {
                                const next = !showWaitingList;
                                setShowWaitingList(next);
                                saveShowWaitingList(next);
                              }}
                              aria-expanded={showWaitingList}
                              aria-controls="queue-waiting-list"
                            >
                              {showWaitingList ? (
                                <>
                                  <ChevronUp className="mr-1.5 h-4 w-4" />
                                  Hide waiting list
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="mr-1.5 h-4 w-4" />
                                  Show waiting list ({queueWithStats.length - 4})
                                </>
                              )}
                            </Button>
                            <div className="queue-divider" role="separator">
                              <span>Waiting in line</span>
                            </div>
                          </div>
                          <div
                            id="queue-waiting-list"
                            className={cn("space-y-2", !showWaitingList && "hidden")}
                          >
                            {queueWithStats.slice(4).map((entry, offset) =>
                              renderQueuedEntry(entry, offset + 4),
                            )}
                          </div>
                        </QueueDndZone>
                      ) : null}
                    </SortableQueueList>
                  ) : null}
                  {!readOnly && !isPastGame ? (
                    <QueueCheckedOutList
                      entries={checkedOutWithStats}
                      expanded={showCheckedOutList}
                      onToggle={() => {
                        const next = !showCheckedOutList;
                        setShowCheckedOutList(next);
                        saveShowCheckedOutList(next);
                      }}
                      onCheckBackIn={(entry) => checkBackInMutation.mutate(entry._id)}
                      checkBackInPendingId={
                        checkBackInMutation.isPending
                          ? (checkBackInMutation.variables ?? null)
                          : null
                      }
                    />
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel courts-panel">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Courts</CardTitle>
                <CourtsSummary courts={courts} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="courts-toggle shrink-0 lg:hidden"
                onClick={() => {
                  const next = !showCourts;
                  setShowCourts(next);
                  saveShowCourts(next);
                }}
                aria-expanded={showCourts}
                aria-controls="courts-list"
              >
                {showCourts ? (
                  <>
                    <ChevronUp className="mr-1.5 h-4 w-4" />
                    Hide courts
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1.5 h-4 w-4" />
                    Show courts
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent
              id="courts-list"
              className={cn(
                "court-grid court-grid--list grid grid-cols-1 gap-3",
                !showCourts && "hidden lg:grid",
              )}
            >
              {courts.map((court) => (
                <CourtCard
                  key={court._id}
                  court={court}
                  playerSessionStats={playerSessionStats}
                  canReplacePlayers={
                    !hideControls && court.status === "active" && queueWithStats.length > 0
                  }
                  onReplacePlayer={
                    hideControls
                      ? undefined
                      : ({ courtNumber, team, slotIndex, player }) =>
                          setReplaceDialog({
                            kind: "court",
                            courtNumber,
                            team,
                            slotIndex,
                            player,
                          })
                  }
                  replacePendingKey={courtReplacePendingKey}
                  hideEndGame={hideControls}
                  onEndGame={
                    hideControls
                      ? () => {}
                      : () => {
                          setPendingWinner(null);
                          setTeamAScore("");
                          setTeamBScore("");
                          setEndTargetCourt(court.courtNumber);
                        }
                  }
                  onSwapTeams={
                    hideControls ? undefined : () => swapCourtMutation.mutate(court.courtNumber)
                  }
                  swapPending={
                    swapCourtMutation.isPending &&
                    swapCourtMutation.variables === court.courtNumber
                  }
                  onCancelAssignment={
                    hideControls ||
                    court.status !== "active" ||
                    isCourtRematch(court)
                      ? undefined
                      : () => setCancelCourtTarget(court.courtNumber)
                  }
                  cancelPending={
                    cancelCourtMutation.isPending &&
                    cancelCourtMutation.variables === court.courtNumber
                  }
                  onCancelRematch={
                    hideControls ||
                    court.status !== "active" ||
                    !isCourtRematch(court)
                      ? undefined
                      : () => setCancelRematchTarget(court.courtNumber)
                  }
                  cancelRematchPending={
                    cancelRematchMutation.isPending &&
                    cancelRematchMutation.variables === court.courtNumber
                  }
                  isFilling={
                    fillingCourtNumber != null && court.courtNumber === fillingCourtNumber
                  }
                />
              ))}
            </CardContent>
          </Card>
        </section>
        )}

        <Card className="glass-panel match-history-panel">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Match History</CardTitle>
              <p className="caption">
                {matches.length} {matches.length === 1 ? "match" : "matches"} recorded
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="match-history-toggle shrink-0"
              onClick={() => {
                const next = !showMatchHistory;
                setShowMatchHistory(next);
                saveShowMatchHistory(next);
              }}
              aria-expanded={showMatchHistory}
              aria-controls="match-history-list"
            >
              {showMatchHistory ? (
                <>
                  <ChevronUp className="mr-1.5 h-4 w-4" />
                  Hide match history
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1.5 h-4 w-4" />
                  Show match history
                </>
              )}
            </Button>
          </CardHeader>
          {showMatchHistory ? (
            <CardContent id="match-history-list">
              <MatchHistoryList matches={matches} gameId={gameId} editable={!hideControls} />
            </CardContent>
          ) : null}
        </Card>
      </section>

      {!readOnly ? (
        <>
          <FillCourtConfirmDialog
            open={fillCourtDialogOpen}
            onOpenChange={setFillCourtDialogOpen}
            courtNumber={nextEmptyCourt?.courtNumber ?? null}
            teamA={fillCourtTeamA}
            teamB={fillCourtTeamB}
            canReplace={waitingLineEntries.length > 0}
            onReplace={(sourceIndex, sourceEntry) =>
              setReplaceDialog({ kind: "queue", sourceIndex, sourceEntry })
            }
            replacePendingSourceIndex={
              replaceMutation.isPending ? (replaceMutation.variables?.sourceIndex ?? null) : null
            }
            onConfirmFill={() => {
              setFillCourtDialogOpen(false);
              startMutation.mutate();
            }}
            fillPending={startMutation.isPending}
            onShuffle={async () => {
              await shuffleNextMutation.mutateAsync();
            }}
          />
          <ReplacePlayerDialog
            open={replaceDialog !== null}
            onOpenChange={(open) => {
              if (!open) setReplaceDialog(null);
            }}
            state={replaceDialog}
            waitingEntries={waitingLineEntries}
            courtReplaceEntries={queueWithStats}
            isPending={replaceMutation.isPending || replaceCourtMutation.isPending}
            onConfirm={handleReplaceConfirm}
          />
          <Dialog
            open={cancelCourtTarget !== null}
            onOpenChange={(open) => {
              if (!open && !cancelCourtMutation.isPending) setCancelCourtTarget(null);
            }}
          >
            <DialogContent className="cancel-court-dialog sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cancel court assignment?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Return all four players on{" "}
                <span className="font-medium text-foreground">Court {cancelCourtTarget}</span> to
                the top of the queue? The waiting line order will be restored. You can only cancel
                within the first 5 minutes after filling the court.
              </p>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelCourtMutation.isPending}
                  onClick={() => setCancelCourtTarget(null)}
                >
                  Keep on court
                </Button>
                <Button
                  type="button"
                  disabled={cancelCourtMutation.isPending || cancelCourtTarget === null}
                  onClick={() => {
                    if (cancelCourtTarget === null) return;
                    cancelCourtMutation.mutate(cancelCourtTarget);
                  }}
                >
                  {cancelCourtMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Cancelling…
                    </>
                  ) : (
                    "Yes, cancel assignment"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={cancelRematchTarget !== null}
            onOpenChange={(open) => {
              if (!open && !cancelRematchMutation.isPending) setCancelRematchTarget(null);
            }}
          >
            <DialogContent className="cancel-rematch-dialog sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cancel rematch?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Return all four players on{" "}
                <span className="font-medium text-foreground">Court {cancelRematchTarget}</span> to
                the queue? The last completed match stays in history — only this rematch is undone.
                You can only cancel within the first 5 minutes after the rematch started.
              </p>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelRematchMutation.isPending}
                  onClick={() => setCancelRematchTarget(null)}
                >
                  Keep playing
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cancelRematchMutation.isPending || cancelRematchTarget === null}
                  onClick={() => {
                    if (cancelRematchTarget === null) return;
                    cancelRematchMutation.mutate(cancelRematchTarget);
                  }}
                >
                  {cancelRematchMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Cancelling…
                    </>
                  ) : (
                    "Yes, cancel rematch"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {!readOnly && game.publicQrCodeDataUrl && game.registerUrl ? (
        <GameQrDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          gameTitle={game.title}
          registerUrl={game.registerUrl}
          qrCodeDataUrl={game.publicQrCodeDataUrl}
        />
      ) : null}

      {!readOnly ? (
        <Dialog open={endTargetCourt !== null} onOpenChange={(open) => (!open ? closeEndDialog() : undefined)}>
          <DialogContent className="court-winner-dialog">
            <DialogHeader>
              <DialogTitle>
                {pendingWinner
                  ? `Team ${pendingWinner} won — enter the score`
                  : `Who won on Court ${endTargetCourt}?`}
              </DialogTitle>
            </DialogHeader>

            {pendingWinner === null ? (
              <div className="court-winner-dialog-actions grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="court-winner-btn"
                    onClick={() => {
                      setPendingWinner("A");
                      setTeamAScore("11");
                      setTeamBScore("0");
                    }}
                  >
                    Team A won
                  </Button>
                  <CourtWinnerTeamRoster players={endCourt?.teamA.playerIds ?? []} />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="court-winner-btn"
                    onClick={() => {
                      setPendingWinner("B");
                      setTeamBScore("11");
                      setTeamAScore("0");
                    }}
                  >
                    Team B won
                  </Button>
                  <CourtWinnerTeamRoster players={endCourt?.teamB.playerIds ?? []} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {winningPlayers.length > 0 ? (
                  <div className="surface-muted flex flex-col gap-2 rounded-xl border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Winners · Team {pendingWinner}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {winningPlayers.map((player, index) => (
                        <li
                          key={
                            player._id != null
                              ? `${String(player._id)}-${index}`
                              : `${player.firstName}-${player.lastName}-${index}`
                          }
                          className="flex items-center gap-2.5"
                        >
                          <PlayerAvatar
                            player={player}
                            size="sm"
                            className="!size-9 sm:!size-9"
                          />
                          <span className="font-medium">
                            {formatPlayerDisplayName(player.firstName, player.lastName)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="team-a-score"
                      className={cn(
                        "text-sm font-medium",
                        pendingWinner === "A" && "text-primary",
                      )}
                    >
                      Team A
                      {pendingWinner === "A"
                        ? " (winner)"
                        : pendingWinner != null
                          ? " (loser)"
                          : ""}
                    </label>
                    <Input
                      id="team-a-score"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      min={0}
                      max={
                        pendingWinner === "A"
                          ? MAX_MATCH_SCORE
                          : endGameLoserScoreMax ?? MAX_MATCH_SCORE
                      }
                      placeholder="—"
                      value={teamAScore}
                      onChange={(event) => setTeamAScore(sanitizeScoreInput(event.target.value))}
                      aria-invalid={endGameScoreError != null && pendingWinner === "B"}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="team-b-score"
                      className={cn(
                        "text-sm font-medium",
                        pendingWinner === "B" && "text-primary",
                      )}
                    >
                      Team B
                      {pendingWinner === "B"
                        ? " (winner)"
                        : pendingWinner != null
                          ? " (loser)"
                          : ""}
                    </label>
                    <Input
                      id="team-b-score"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      min={0}
                      max={
                        pendingWinner === "B"
                          ? MAX_MATCH_SCORE
                          : endGameLoserScoreMax ?? MAX_MATCH_SCORE
                      }
                      placeholder="—"
                      value={teamBScore}
                      onChange={(event) => setTeamBScore(sanitizeScoreInput(event.target.value))}
                      aria-invalid={endGameScoreError != null && pendingWinner === "A"}
                    />
                  </div>
                </div>
                {endGameScoreError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {endGameScoreError}
                  </p>
                ) : null}
                <div className="end-game-rematch-block">
                  <div className="end-game-rematch-row">
                    <span className="end-game-rematch-label">Rematch?</span>
                    <div className="end-game-rematch-toggle" role="group" aria-label="Rematch">
                      <Button
                        type="button"
                        size="sm"
                        variant={endGameRematch ? "outline" : "default"}
                        className="end-game-rematch-btn"
                        disabled={endMutation.isPending}
                        onClick={() => setEndGameRematch(false)}
                      >
                        No
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={endGameRematch ? "default" : "outline"}
                        className="end-game-rematch-btn"
                        disabled={endMutation.isPending}
                        onClick={() => setEndGameRematch(true)}
                      >
                        Yes
                      </Button>
                    </div>
                  </div>
                  <p className="end-game-rematch-hint">
                    {endGameRematch
                      ? "Same four, fresh clock on this court."
                      : "Return all four to the queue."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={endMutation.isPending}
                    onClick={() => {
                      setPendingWinner(null);
                      setEndGameRematch(false);
                      setTeamAScore("");
                      setTeamBScore("");
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={endMutation.isPending || endGameScoreError != null}
                    onClick={() => {
                      if (!pendingWinner || endGameScoreError || endTargetCourt == null) return;
                      const a = teamAScore.trim();
                      const b = teamBScore.trim();
                      endMutation.mutate({
                        courtNumber: endTargetCourt,
                        winnerTeam: pendingWinner,
                        teamAScore: a === "" ? 0 : Number(a),
                        teamBScore: b === "" ? 0 : Number(b),
                        rematch: endGameRematch,
                      });
                    }}
                  >
                    {endMutation.isPending
                      ? "Saving…"
                      : endGameRematch
                        ? "Start rematch"
                        : "End game"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </main>
  );
}
