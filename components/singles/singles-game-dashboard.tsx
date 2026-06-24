"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, CalendarDays, Clock, Loader2, LogOut, Trophy, UserPlus, Zap } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Swal from "sweetalert2";

import { AddCourtButton } from "@/components/game/add-court-button";
import { AddManualPlayerDialog } from "@/components/game/add-manual-player-dialog";
import { CourtEndGameDialog } from "@/components/game/court-end-game-dialog";
import { GameDashboardMobileNav } from "@/components/game/game-dashboard-mobile-nav";
import { GamePlayerProfileProvider } from "@/components/game/game-player-profile-context";
import { GameSessionActionsMenu } from "@/components/game/game-session-actions-menu";
import { SwitchToCourtViewButton } from "@/components/game/switch-to-court-view-button";
import { LeaderboardSection } from "@/components/game/leaderboard-section";
import { MatchHistoryList } from "@/components/game/match-history-list";
import { OpenPlaySkillLevelPills } from "@/components/game/open-play-skill-level-pills";
import { QueueCallNamesButton } from "@/components/game/queue-call-names-button";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import {
  ReplacePlayerDialog,
  type ReplacePlayerConfirmInput,
  type ReplacePlayerDialogState,
} from "@/components/game/replace-player-dialog";
import {
  QueueDndZone,
  QueueDragHandle,
  SortableQueueItem,
  SortableQueueList,
  type QueueDragHandleProps,
} from "@/components/game/sortable-queue-list";
import { SinglesCourtCard } from "@/components/singles/singles-court-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import {
  canCancelCourtAssignment,
  toCourtTimerClock,
} from "@/lib/court-cancel-grace";
import {
  beginEphemeralQuickGameSaveToAccount,
  promptSaveEphemeralQuickGame,
} from "@/lib/ephemeral-quick-game-transfer";
import { formatOpenPlayDate } from "@/lib/open-play-time-range";
import {
  applyCheckoutOptimistic,
  applyCourtPauseOptimistic,
  applyEndOpenPlayOptimistic,
  applyQueueReorderOptimistic,
  applyQueueSwapByIndexOptimistic,
  applyRemovePlayerOptimistic,
  type ReplaceQueueMutationInput,
} from "@/lib/game-payload-mutations";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerSessionStatsMap,
  buildSessionLeaderboardRankMap,
} from "@/lib/games-played-map";
import { addLocalCourt } from "@/lib/local-game-session";
import { isEphemeralQuickGame } from "@/lib/local-game-id";
import { buildLocalLeaderboardRecap } from "@/lib/local-leaderboard-recap";
import { prefetchLeaderboardRecap } from "@/lib/fetch-leaderboard";
import { getMatchScoreInputError } from "@/lib/match-score-validation";
import {
  readOperatorGamePayload,
  seedLocalGameOperatorCache,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";
import { useQuickGameSession, readQuickGamePayload } from "@/lib/quick-game-store";
import { MAX_QUICK_PLAY_COURTS } from "@/lib/quick-play-wizard-shared";
import { queueEntryPlayerId } from "@/lib/queue-highlight";
import { buildSessionPlayerLookup } from "@/lib/session-player-lookup";
import {
  isSinglesWinnerLoserRotation,
  pickSinglesCourtPair,
} from "@/lib/singles/singles-queue-fill";
import { SINGLES_MIN_QUEUE_TO_FILL } from "@/lib/singles/singles-constants";
import {
  applySinglesCancelCourtAssignmentOptimistic,
  applySinglesEndGameWithHistoryOptimistic,
  applySinglesFillCourtOptimistic,
  canSinglesFillCourt,
  type SinglesEndGameInput,
} from "@/lib/singles/singles-payload-mutations";
import { swalAlertBaseOptions } from "@/lib/swal-theme";
import { toastOperationError } from "@/lib/toast-error";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

type SinglesGameDashboardProps = {
  quickGameSurface?: "account" | "ephemeral";
};

type MobileTab = "queue" | "courts" | "history";

const MATCH_HISTORY_STORAGE_KEY = "ccf-match-history-visible";

function loadMatchHistoryVisible() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MATCH_HISTORY_STORAGE_KEY) === "true";
}

function saveMatchHistoryVisible(visible: boolean) {
  localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, visible ? "true" : "false");
}

export function SinglesGameDashboard({ quickGameSurface }: SinglesGameDashboardProps) {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const gameId = String(params.id ?? "");
  const isEphemeralQuickSession = isEphemeralQuickGame(gameId);
  const { mounted } = useQuickGameSessionAfterMount(gameId);
  const payload = useQuickGameSession(gameId);

  const [mobileTab, setMobileTab] = useState<MobileTab>("courts");
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [pendingWinner, setPendingWinner] = useState<"A" | "B" | null>(null);
  const [endGameRematch, setEndGameRematch] = useState(false);
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [replaceDialog, setReplaceDialog] = useState<ReplacePlayerDialogState | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

  useEffect(() => {
    setShowMatchHistory(loadMatchHistoryVisible());
  }, []);

  useEffect(() => {
    if (!mounted || !gameId || !isEphemeralQuickSession) return;
    if (quickGameSurface !== "ephemeral") {
      router.replace(`/games/${gameId}`);
      return;
    }
    if (payload) return;
    const timer = window.setTimeout(() => {
      if (!readQuickGamePayload(gameId)) {
        toast.error("Session not found. Start a new quick play session.");
        router.replace("/play");
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [gameId, isEphemeralQuickSession, mounted, payload, quickGameSurface, router]);

  useEffect(() => {
    if (!gameId || !payload) return;
    seedLocalGameOperatorCache(queryClient, gameId);
  }, [gameId, payload, queryClient]);

  const game = payload?.game;
  const courts = payload?.courts ?? [];
  const matches = payload?.matches ?? [];
  const isPastGame = game?.status === "ended";

  const playerSessionStats = useMemo(
    () => buildPlayerSessionStatsMap(payload?.leaderboard),
    [payload?.leaderboard],
  );

  const queueWithStats = useMemo(
    () => (payload?.queue ?? []).map((entry) => attachSessionStatsToQueueEntry(entry, playerSessionStats)),
    [payload?.queue, playerSessionStats],
  );

  const leaderboardRows = useMemo(
    () => (payload ? buildLocalLeaderboardRecap(payload).rows : []),
    [payload],
  );
  const leaderboardRankMap = useMemo(() => {
    const courtParticipants = courts.flatMap((court) => [
      ...(court.teamA?.playerIds ?? []).map((playerId) => ({ playerId })),
      ...(court.teamB?.playerIds ?? []).map((playerId) => ({ playerId })),
    ]);
    return buildSessionLeaderboardRankMap(payload?.leaderboard, [
      ...queueWithStats,
      ...courtParticipants,
    ]);
  }, [payload?.leaderboard, queueWithStats, courts]);

  const fillableCourts = courts.filter(
    (court) => payload != null && canSinglesFillCourt(payload, court),
  );
  const canFillAnyCourt = fillableCourts.length > 0;
  const nextCourtPair = useMemo(() => {
    if (!payload) return null;
    const pair = pickSinglesCourtPair(payload.queue, payload.game.matchingType);
    if (!pair) return null;
    const byId = new Map(queueWithStats.map((entry) => [entry._id, entry]));
    return pair
      .map((entry) => byId.get(entry._id))
      .filter((entry): entry is (typeof queueWithStats)[number] => entry != null);
  }, [payload, queueWithStats]);
  const nextCourtPairIds = useMemo(
    () => new Set(nextCourtPair?.map((entry) => entry._id) ?? []),
    [nextCourtPair],
  );
  const waitingLineEntries = useMemo(
    () => queueWithStats.filter((entry) => !nextCourtPairIds.has(entry._id)),
    [queueWithStats, nextCourtPairIds],
  );
  const usesWinnerLoserRotation = isSinglesWinnerLoserRotation(game?.matchingType);
  const rotationQueueSegments = useMemo(() => {
    if (!usesWinnerLoserRotation) return null;
    const normals = queueWithStats.filter(
      (entry) => entry.queueType !== "winner" && entry.queueType !== "loser",
    );
    const winners = queueWithStats.filter((entry) => entry.queueType === "winner");
    const losers = queueWithStats.filter((entry) => entry.queueType === "loser");
    return {
      normalWaiting: normals.filter((entry) => !nextCourtPairIds.has(entry._id)),
      winners,
      losers,
    };
  }, [queueWithStats, nextCourtPairIds, usesWinnerLoserRotation]);

  const queueDisplayEntries = useMemo(() => {
    if (!usesWinnerLoserRotation || !rotationQueueSegments) {
      return queueWithStats;
    }
    return [
      ...(nextCourtPair ?? []),
      ...rotationQueueSegments.normalWaiting,
      ...rotationQueueSegments.winners,
      ...rotationQueueSegments.losers,
    ];
  }, [
    nextCourtPair,
    queueWithStats,
    rotationQueueSegments,
    usesWinnerLoserRotation,
  ]);

  const queueDisplayEntryIds = useMemo(
    () => queueDisplayEntries.map((entry) => entry._id),
    [queueDisplayEntries],
  );

  const queueDisplayIndexById = useMemo(() => {
    const map = new Map<string, number>();
    queueDisplayEntries.forEach((entry, index) => map.set(entry._id, index));
    return map;
  }, [queueDisplayEntries]);

  const queueIndexById = useMemo(() => {
    const map = new Map<string, number>();
    (payload?.queue ?? []).forEach((entry, index) => map.set(entry._id, index));
    return map;
  }, [payload?.queue]);

  const canReorderQueue = !isPastGame && queueDisplayEntries.length >= 2;

  const closeEndDialog = () => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  };

  const fillMutation = useMutation({
    mutationFn: async (courtNumber: number) => ({ courtNumber }),
    onMutate: async (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applySinglesFillCourtOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Court filled from the queue.");
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to fill court.");
    },
  });

  const endMutation = useMutation({
    mutationFn: async (input: SinglesEndGameInput) => input,
    onMutate: async (input) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applySinglesEndGameWithHistoryOptimistic(previous, input);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      closeEndDialog();
      return { previous };
    },
    onSuccess: (input) => {
      toast.success(
        input.rematch
          ? `Court ${input.courtNumber} rematch started.`
          : "Game ended and players returned to the queue.",
      );
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to end game.");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async ({ courtNumber, paused }: { courtNumber: number; paused: boolean }) => ({
      courtNumber,
      paused,
    }),
    onMutate: async ({ courtNumber, paused }) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyCourtPauseOptimistic(previous, courtNumber, paused);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to update court pause.");
    },
  });

  const reorderQueueMutation = useMutation({
    mutationFn: async (_orderedEntryIds: string[]) => ({ message: "Queue order updated." }),
    onMutate: async (orderedEntryIds) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyQueueReorderOptimistic(previous, orderedEntryIds);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to reorder queue.");
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async (_input: ReplaceQueueMutationInput) => ({ message: "Queue player replaced." }),
    onMutate: async (variables) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyQueueSwapByIndexOptimistic(
        previous,
        variables.sourceIndex,
        variables.targetIndex,
      );
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to replace player.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (_input: { queueEntryId: string }) => ({ message: "Player checked out." }),
    onMutate: async (variables) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyCheckoutOptimistic(previous, variables.queueEntryId);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to check out player.");
    },
  });

  const removePlayerFromGameMutation = useMutation({
    mutationFn: async (_input: { playerId: string }) => ({ message: "Player removed from session." }),
    onMutate: async (variables) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyRemovePlayerOptimistic(previous, variables.playerId);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to remove player.");
    },
  });

  const addCourtMutation = useMutation({
    mutationFn: async () => ({ message: "Court added." }),
    onMutate: async () => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = addLocalCourt(previous, MAX_QUICK_PLAY_COURTS);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to add court.");
    },
  });

  const cancelCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => courtNumber,
    onMutate: async (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applySinglesCancelCourtAssignmentOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: () => toast.success("Court assignment cancelled."),
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to cancel court assignment.");
    },
  });

  const endOpenPlayMutation = useMutation({
    mutationFn: async () => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) throw new Error("Session not found.");
      const ended = applyEndOpenPlayOptimistic(previous);
      writeOperatorGamePayload(queryClient, gameId, ended);
      return { message: "Open play ended." };
    },
    onSuccess: (result) => {
      toast.success(result.message);
      router.replace(`/leaderboard/${gameId}`);
    },
    onError: (error) => toastOperationError(error, "Failed to end open play."),
  });

  const handleEndOpenPlay = async () => {
    if (isEphemeralQuickSession) {
      const saveChoice = await promptSaveEphemeralQuickGame();
      if (saveChoice === "dismiss") return;
      if (saveChoice === "save") {
        await beginEphemeralQuickGameSaveToAccount({
          gameId,
          queryClient,
          router,
          endAfterSave: true,
        });
        return;
      }
    }

    const result = await Swal.fire({
      ...swalAlertBaseOptions,
      title: "End Open Play?",
      text: "This will mark this singles session as ended.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, end it",
      cancelButtonText: "Cancel",
    });
    if (result.isConfirmed) endOpenPlayMutation.mutate();
  };

  const handleReplaceConfirm = (input: ReplacePlayerConfirmInput) => {
    if (input.kind !== "queue") return;
    replaceMutation.mutate({
      sourceIndex: input.sourceIndex,
      targetIndex: input.targetIndex,
    });
  };

  const confirmRemoveFromQueue = async (entry: QueueEntryView) => {
    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );
    const result = await Swal.fire({
      ...swalAlertBaseOptions,
      title: "Check out?",
      html: `<strong>${playerName}</strong> will be checked out of the queue. Their registration and match history are kept.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, check out",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    removeMutation.mutate({ queueEntryId: entry._id });
  };

  const confirmRemovePlayerFromGame = async (entry: QueueEntryView) => {
    const playerId = queueEntryPlayerId(entry);
    if (!playerId) return;
    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );
    const result = await Swal.fire({
      ...swalAlertBaseOptions,
      title: "Remove player?",
      html: `<strong>${playerName}</strong> will be removed from this session entirely (queue, court assignments, and match history).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove player",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    removePlayerFromGameMutation.mutate({ playerId });
  };

  const endCourt =
    endTargetCourt != null ? courts.find((court) => court.courtNumber === endTargetCourt) : undefined;
  const sessionPlayerLookup = useMemo(
    () =>
      buildSessionPlayerLookup({
        queue: queueWithStats,
        checkedOut: payload?.checkedOut ?? [],
        courts,
      }),
    [courts, payload?.checkedOut, queueWithStats],
  );
  const endGameScoreError =
    pendingWinner != null
      ? getMatchScoreInputError(pendingWinner, teamAScore, teamBScore, { required: true })
      : null;

  const fillingCourtNumber =
    fillMutation.isPending && fillMutation.variables != null ? fillMutation.variables : null;

  const openPlayDateLabel = game ? formatOpenPlayDate(game.openPlayDate) : null;
  const openPlayTimeLabel = game?.openPlayTimeRange?.trim() || null;
  const leaderboardHref = `/leaderboard/${gameId}`;
  const quickGameExitHref = "/play";

  if (!mounted || !payload || !game) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading singles session…
        </div>
      </main>
    );
  }

  const showManualAddPlayer =
    !isPastGame &&
    game.allowManualPlayerAdd === true &&
    (game.registrationMode === "owner" || game.registrationMode == null);

  const showManualCourtAdd =
    !isPastGame &&
    game.allowManualCourtAdd === true &&
    (game.registrationMode === "owner" || game.registrationMode == null);

  const canAddMoreCourts = courts.length < MAX_QUICK_PLAY_COURTS;

  const renderQueueEntryRow = (
    entry: (typeof queueWithStats)[number],
    displayIndex: number,
    drag?: QueueDragHandleProps,
  ) => {
    const queueIndex = queueIndexById.get(entry._id) ?? displayIndex;
    const isNextUp = nextCourtPairIds.has(entry._id);

    return (
      <QueueEntryRow
        entry={entry}
        index={displayIndex}
        isNextUp={isNextUp}
        inWaitingLine={!isNextUp}
        canReplace={!isPastGame && isNextUp && waitingLineEntries.length > 0}
        onReplace={
          !isPastGame && isNextUp
            ? () =>
                setReplaceDialog({
                  kind: "queue",
                  sourceIndex: queueIndex,
                  sourceEntry: entry,
                })
            : () => {}
        }
        replacePending={
          replaceMutation.isPending && replaceMutation.variables?.sourceIndex === queueIndex
        }
        hideReplacePanel={isPastGame}
        onRemove={!isPastGame ? () => void confirmRemoveFromQueue(entry) : undefined}
        removePending={
          removeMutation.isPending && removeMutation.variables?.queueEntryId === entry._id
        }
        onRemovePlayer={
          !isPastGame ? () => void confirmRemovePlayerFromGame(entry) : undefined
        }
        removePlayerPending={
          removePlayerFromGameMutation.isPending &&
          removePlayerFromGameMutation.variables?.playerId === queueEntryPlayerId(entry)
        }
        showLeaderboardRank
        leaderboardRankMap={leaderboardRankMap}
        dragHandle={
          drag ? (
            <QueueDragHandle
              {...drag}
              label={`Reorder ${formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName)} in queue`}
            />
          ) : undefined
        }
      />
    );
  };

  const renderQueuedEntry = (entry: (typeof queueWithStats)[number]) => {
    const index = queueDisplayIndexById.get(entry._id) ?? 0;
    return (
      <SortableQueueItem key={entry._id} id={entry._id} enabled={canReorderQueue}>
        {(drag) => renderQueueEntryRow(entry, index, drag)}
      </SortableQueueItem>
    );
  };

  const nextFillableCourtNumber = fillableCourts[0]?.courtNumber ?? null;

  const renderQueuePanel = () => (
    <Card className="glass-panel dashboard-panel min-w-0">
      <CardHeader className="dashboard-panel-header flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CardTitle>Queue</CardTitle>
          <Badge variant="secondary">{queueWithStats.length} waiting</Badge>
        </div>
        {!isPastGame && (nextCourtPair?.length ?? 0) > 0 ? (
          <QueueCallNamesButton
            teamA={nextCourtPair?.[0] ? [nextCourtPair[0].playerId] : []}
            teamB={nextCourtPair?.[1] ? [nextCourtPair[1].playerId] : []}
            courtNumber={nextFillableCourtNumber}
          />
        ) : null}
      </CardHeader>
      <CardContent className="queue-list dashboard-panel-content space-y-3">
        {queueWithStats.length === 0 ? (
          <p className="text-muted-foreground">Queue is empty.</p>
        ) : (
          <SortableQueueList
            entryIds={queueDisplayEntryIds}
            enabled={canReorderQueue}
            nextUpCount={SINGLES_MIN_QUEUE_TO_FILL}
            onReorder={(orderedEntryIds) => reorderQueueMutation.mutate(orderedEntryIds)}
          >
            <QueueDndZone zone="next-up" className="space-y-3">
              <div className="queue-next-up-banner">
                <div className="flex items-center gap-2">
                  <span className="queue-next-up-icon">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="queue-next-up-title">Next on court</p>
                    <p className="caption">
                      {usesWinnerLoserRotation
                        ? "Queue order first — paired winners/losers join the end of the line"
                        : `Top ${Math.min(SINGLES_MIN_QUEUE_TO_FILL, queueWithStats.length)} player${
                            Math.min(SINGLES_MIN_QUEUE_TO_FILL, queueWithStats.length) === 1
                              ? ""
                              : "s"
                          }`}
                      {canReorderQueue ? " · drag to reorder" : ""}
                    </p>
                  </div>
                </div>
                <Badge className="badge-next-up-count shrink-0">
                  {nextCourtPair?.length ?? 0} / {SINGLES_MIN_QUEUE_TO_FILL}
                </Badge>
              </div>
              <div className="space-y-2">
                {(nextCourtPair ?? []).map((entry) => renderQueuedEntry(entry))}
              </div>
            </QueueDndZone>
            {usesWinnerLoserRotation && rotationQueueSegments ? (
              <QueueDndZone zone="waiting" className="space-y-3">
                {rotationQueueSegments.normalWaiting.length > 0 ? (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Waiting in line
                    </p>
                    {rotationQueueSegments.normalWaiting.map((entry) => renderQueuedEntry(entry))}
                  </div>
                ) : null}
                {rotationQueueSegments.winners.length > 0 ? (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Winners
                    </p>
                    {rotationQueueSegments.winners.map((entry) => renderQueuedEntry(entry))}
                  </div>
                ) : null}
                {rotationQueueSegments.losers.length > 0 ? (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Losers
                    </p>
                    {rotationQueueSegments.losers.map((entry) => renderQueuedEntry(entry))}
                  </div>
                ) : null}
              </QueueDndZone>
            ) : waitingLineEntries.length > 0 ? (
              <QueueDndZone zone="waiting" className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Waiting in line
                </p>
                {waitingLineEntries.map((entry) => renderQueuedEntry(entry))}
              </QueueDndZone>
            ) : null}
          </SortableQueueList>
        )}
      </CardContent>
    </Card>
  );

  const renderCourtsPanel = () => (
    <Card className="glass-panel dashboard-panel min-w-0">
      <CardHeader className="dashboard-panel-header">
        <CardTitle>Courts</CardTitle>
        <Badge variant="outline">Singles · 1v1</Badge>
      </CardHeader>
      <CardContent className="dashboard-panel-content">
        <div className="court-grid-theme grid grid-cols-1 gap-4">
        {courts.map((court) => {
          const canFill = canSinglesFillCourt(payload, court);
          const canCancel =
            court.status === "active" &&
            canCancelCourtAssignment(toCourtTimerClock(court));
          return (
            <SinglesCourtCard
              key={court._id}
              court={court}
              playerSessionStats={playerSessionStats}
              playerLeaderboardRanks={leaderboardRankMap}
              onEndGame={() => setEndTargetCourt(court.courtNumber)}
              onCancelAssignment={
                canCancel ? () => cancelCourtMutation.mutate(court.courtNumber) : undefined
              }
              cancelPending={
                cancelCourtMutation.isPending &&
                cancelCourtMutation.variables === court.courtNumber
              }
              onTogglePause={
                court.status === "active"
                  ? () =>
                      pauseMutation.mutate({
                        courtNumber: court.courtNumber,
                        paused: !court.pausedAt,
                      })
                  : undefined
              }
              pausePending={
                pauseMutation.isPending && pauseMutation.variables?.courtNumber === court.courtNumber
              }
              isFilling={fillingCourtNumber === court.courtNumber}
              canFillCourt={canFill}
              fillCourtPending={fillMutation.isPending}
              onFillCourt={
                !isPastGame && canFill ? () => fillMutation.mutate(court.courtNumber) : undefined
              }
            />
          );
        })}
        {showManualCourtAdd ? (
          <AddCourtButton
            onClick={() => addCourtMutation.mutate()}
            pending={addCourtMutation.isPending}
            disabled={!canAddMoreCourts}
          />
        ) : null}
        </div>
      </CardContent>
    </Card>
  );

  const renderHistoryPanel = () => (
      <Card className="glass-panel match-history-panel dashboard-panel dashboard-panel--history min-w-0">
        <CardHeader className="flex flex-col gap-3 space-y-0">
          <div className="match-history-panel-header flex w-full flex-nowrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>Match history</CardTitle>
              <p className="caption">
                {matches.length} {matches.length === 1 ? "match" : "matches"}
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
                saveMatchHistoryVisible(next);
              }}
              aria-expanded={showMatchHistory}
              aria-controls="singles-match-history-list"
            >
              {showMatchHistory ? (
                <>
                  <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden />
                  Hide match history
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1.5 h-4 w-4" aria-hidden />
                  Show match history
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {showMatchHistory ? (
          <CardContent id="singles-match-history-list" className="dashboard-panel-content">
            <MatchHistoryList matches={matches} gameId={gameId} editable={!isPastGame} showNameFilter />
          </CardContent>
        ) : null}
      </Card>
    );

  return (
    <GamePlayerProfileProvider profileEnabled>
      <main
        className={cn(
          "game-dashboard--operator relative min-h-screen p-4 md:p-6",
          !isPastGame &&
            "pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-6",
        )}
      >
        <section className="mx-auto flex max-w-[1600px] flex-col gap-4">
          <Card className="glass-panel game-dashboard-header">
            <CardContent className="game-dashboard-header-content relative">
              {!isPastGame ? (
                <div className="game-dashboard-header-actions">
                  {showManualAddPlayer ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="game-dashboard-add-player-btn h-8 gap-1 px-2 text-xs font-semibold shadow-sm lg:hidden"
                      onClick={() => setAddPlayerOpen(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Add player
                    </Button>
                  ) : null}
                  <SwitchToCourtViewButton
                    gameId={gameId}
                    variant="operator"
                    showLabel
                    buttonClassName="game-dashboard-court-view-btn h-8 gap-1 px-2 text-xs font-semibold shadow-sm sm:gap-1.5 sm:px-2.5 lg:h-11 lg:gap-2 lg:px-5 lg:text-base"
                  />
                </div>
              ) : null}
              <div className="game-dashboard-header-top">
                <div className="game-dashboard-header-main min-w-0">
                  <h1 className="page-title">{game.title}</h1>
                  <OpenPlaySkillLevelPills openPlayType={game.openPlayType} className="mt-1" />
                  {isEphemeralQuickSession ? (
                    <p className="caption mt-1 text-muted-foreground">
                      Public quick play — this session lives only in this browser. Nothing is saved
                      to our servers.
                    </p>
                  ) : null}
                </div>
                <div className="game-dashboard-meta">
                  {openPlayDateLabel ? (
                    <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
                      <CalendarDays className="mr-1 h-3 w-3 shrink-0" aria-hidden />
                      {openPlayDateLabel}
                    </Badge>
                  ) : null}
                  {openPlayTimeLabel ? (
                    <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
                      <Clock className="mr-1 h-3 w-3 shrink-0" aria-hidden />
                      {openPlayTimeLabel}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
                    Courts: {game.courtCount}
                  </Badge>
                  <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
                    Singles · 1v1
                  </Badge>
                  {isPastGame ? (
                    <Badge variant="destructive" className="game-dashboard-meta-badge w-fit">
                      Status: ended
                    </Badge>
                  ) : null}
                </div>
              </div>
              {!isPastGame ? (
                <div className="game-toolbar mt-4 flex flex-wrap items-center gap-2">
                  {showManualAddPlayer ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="hidden lg:inline-flex"
                      onClick={() => setAddPlayerOpen(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" aria-hidden />
                      Add player
                    </Button>
                  ) : null}
                  <Link
                    href={leaderboardHref}
                    className="hidden lg:contents"
                    onMouseEnter={() => prefetchLeaderboardRecap(queryClient, gameId, false)}
                    onFocus={() => prefetchLeaderboardRecap(queryClient, gameId, false)}
                  >
                    <Button size="lg" variant="outline">
                      <Trophy className="mr-2 h-4 w-4" aria-hidden />
                      Leaderboard
                    </Button>
                  </Link>
                  <GameSessionActionsMenu
                    className="!hidden lg:!inline-flex"
                    showEndOpenPlay
                    endOpenPlayPending={endOpenPlayMutation.isPending}
                    onEndOpenPlay={() => void handleEndOpenPlay()}
                  />
                  <Link href={quickGameExitHref} className="hidden lg:contents">
                    <Button size="lg" variant="outline">
                      <LogOut className="mr-2 h-4 w-4" aria-hidden />
                      Exit
                    </Button>
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="game-dashboard-split hidden grid-cols-1 gap-4 lg:grid lg:grid-cols-[2fr_3fr] xl:grid-cols-2">
            {renderQueuePanel()}
            {renderCourtsPanel()}
          </section>

          <div className="lg:hidden">
            <div
              role="tablist"
              aria-label="Singles dashboard sections"
              className="dashboard-mobile-tablist mb-4 grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1.5"
            >
              {(
                [
                  { id: "queue" as const, label: "Queue", count: queueWithStats.length },
                  { id: "courts" as const, label: "Courts" },
                  { id: "history" as const, label: "History", count: matches.length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === tab.id}
                  className={cn(
                    "rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    mobileTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setMobileTab(tab.id)}
                >
                  {tab.label}
                  {"count" in tab && tab.count > 0 ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>
            {mobileTab === "queue"
              ? renderQueuePanel()
              : mobileTab === "courts"
                ? renderCourtsPanel()
                : renderHistoryPanel()}
          </div>

          <section className="hidden lg:block">{renderHistoryPanel()}</section>

          {leaderboardRows.length > 0 ? (
            <LeaderboardSection rows={leaderboardRows} collapsible />
          ) : null}

          {!isPastGame && !canFillAnyCourt && usesWinnerLoserRotation && queueWithStats.length > 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Need two players in the main line, or two winners, or two losers before the next court can fill.
            </p>
          ) : null}
          {!isPastGame && !canFillAnyCourt && !usesWinnerLoserRotation && queueWithStats.length === 1 ? (
            <p className="text-center text-sm text-muted-foreground">
              Add one more player to the queue to fill a court.
            </p>
          ) : null}
        </section>

        {!isPastGame ? (
          <GameDashboardMobileNav
            gameId={gameId}
            isQuickGameSession
            homeHref={quickGameExitHref}
            homeLabel="Exit"
            homeIcon="exit"
            showQr={false}
            qrLoading={false}
            onQrClick={() => {}}
            showDatabaseCheckIn={false}
            onDatabaseCheckInClick={() => {}}
            showEndOpenPlay
            endOpenPlayPending={endOpenPlayMutation.isPending}
            onEndOpenPlay={() => void handleEndOpenPlay()}
            showReset={false}
            resetPending={false}
            onReset={() => {}}
          />
        ) : null}

        <CourtEndGameDialog
          open={endTargetCourt != null}
          endCourt={endCourt}
          playerLookup={sessionPlayerLookup}
          gameMode="singles"
          pendingWinner={pendingWinner}
          onPendingWinnerChange={setPendingWinner}
          endGameRematch={endGameRematch}
          onEndGameRematchChange={setEndGameRematch}
          teamAScore={teamAScore}
          onTeamAScoreChange={setTeamAScore}
          teamBScore={teamBScore}
          onTeamBScoreChange={setTeamBScore}
          endGameScoreError={endGameScoreError}
          onClose={closeEndDialog}
          onSubmit={(input) => {
            if (endTargetCourt == null) return;
            endMutation.mutate({
              courtNumber: endTargetCourt,
              ...input,
            });
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
          nextUpCount={SINGLES_MIN_QUEUE_TO_FILL}
          resolveTargetIndex={(entry) => queueIndexById.get(entry._id) ?? -1}
          onConfirm={handleReplaceConfirm}
        />

        {showManualAddPlayer ? (
          <AddManualPlayerDialog
            gameId={gameId}
            localMode
            sessionOpenPlayType={game.openPlayType}
            open={addPlayerOpen}
            onOpenChange={setAddPlayerOpen}
            onPlayerAdded={() => setMobileTab("queue")}
          />
        ) : null}
      </main>
    </GamePlayerProfileProvider>
  );
}
