"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  QrCode,
  Play,
  RotateCcw,
  RefreshCw,
  House,
  Flag,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  CalendarDays,
  Clock,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import { GamePlayerProfileProvider } from "@/components/game/game-player-profile-context";
import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { PlayerAvatar, resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { GameDashboardMobileNav } from "@/components/game/game-dashboard-mobile-nav";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { promptIfRegistrationFull } from "@/components/game/registration-capacity-prompt";
import {
  MatchHistoryList,
  MatchHistoryScopeToggle,
  type MatchHistoryScope,
  type MatchHistoryView,
} from "@/components/game/match-history-list";
import { filterMatchesForViewer } from "@/lib/match-history-filter";
import { formatOpenPlayDate } from "@/lib/open-play-time-range";
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
  type QueueDragHandleProps,
  SortableQueueItem,
  SortableQueueList,
} from "@/components/game/sortable-queue-list";
import {
  WaitingLineGroupView,
  GAME_QUEUE_DESKTOP_MEDIA,
  WaitingLineViewToggle,
  loadWaitingLineViewMode,
  saveWaitingLineViewMode,
  type WaitingLineViewMode,
} from "@/components/game/queue-waiting-line-panel";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerSessionStatsMap,
  type LeaderboardGamesPlayedRow,
} from "@/lib/games-played-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isDemoOpenPlayTitle } from "@/lib/demo-open-play";
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
  scrollToQueueEntry,
} from "@/lib/queue-highlight";
import {
  getMatchScoreInputError,
  MAX_MATCH_SCORE,
  sanitizeScoreInput,
} from "@/lib/match-score-validation";
import { announceCourtEnded, announceNextCourtPlayers } from "@/lib/call-names-speech";
import { cn, formatPlayerDisplayName } from "@/lib/utils";
import { useOperatorDashboardLease } from "@/hooks/use-operator-dashboard-lease";
import { useOperatorQueueRegistrationSync } from "@/hooks/use-operator-queue-registration-sync";
import { OperatorDashboardLeaseGate } from "@/components/game/operator-dashboard-lease-gate";
import { useSpectatorSessionCleanup } from "@/hooks/use-spectator-session-cleanup";
import { GameCheckoutNotificationBell } from "@/components/game/spectator-notification-bell";
import { dispatchSpectatorCheckoutNotification } from "@/lib/spectator-checkout-notifications";
import {
  mergeSpectatorGamePayload,
  type SpectateDetailsPayload,
  type SpectateLivePayload,
} from "@/lib/spectate-payload";
import {
  fetchOperatorDetails,
  fetchOperatorQueue,
  fetchOperatorShell,
} from "@/lib/fetch-operator-game";
import {
  mergeOperatorGamePayload,
  type OperatorDetailsPayload,
  type OperatorFullPayload,
  type OperatorQueuePayload,
  type OperatorShellPayload,
} from "@/lib/operator-payload";
import { SPECTATOR_LIVE_POLL_MS } from "@/lib/spectator-polling";

export type GameDashboardMode = "operator" | "spectator";

type DashboardMobileTab = "queue" | "courts" | "history";

type GamePayload = OperatorFullPayload;

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

function isSpectatorGameNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /not found/i.test(message);
}

function SpectatorLoadingScreen() {
  return (
    <main className="game-dashboard--spectator relative min-h-screen">
      <div
        className="spectator-loading-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center backdrop-blur-sm"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="text-base font-medium text-foreground">Data is loading…</p>
        <p className="caption text-muted-foreground">Please wait a moment.</p>
      </div>
    </main>
  );
}

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
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MATCH_HISTORY_STORAGE_KEY) === "true";
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
  onRemovePlayer?: (entry: QueueEntryView) => void;
  removePlayerPendingId?: string | null;
};

function QueueCheckedOutList({
  entries,
  expanded,
  onToggle,
  onCheckBackIn,
  checkBackInPendingId,
  onRemovePlayer,
  removePlayerPendingId,
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
                  onRemovePlayer={
                    onRemovePlayer ? () => onRemovePlayer(entry) : undefined
                  }
                  removePlayerPending={
                    removePlayerPendingId != null &&
                    queueEntryPlayerId(entry) === removePlayerPendingId
                  }
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

function operatorShellQueryKey(gameId: string) {
  return ["game", gameId, "operator", "shell"] as const;
}

function operatorQueueQueryKey(gameId: string) {
  return ["game", gameId, "operator", "queue"] as const;
}

function operatorDetailsQueryKey(gameId: string) {
  return ["game", gameId, "operator", "details"] as const;
}

function readOperatorPayload(
  queryClient: ReturnType<typeof useQueryClient>,
  gameId: string,
): GamePayload | undefined {
  const shell = queryClient.getQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId));
  if (!shell) return undefined;
  const queue = queryClient.getQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId));
  const details = queryClient.getQueryData<OperatorDetailsPayload>(operatorDetailsQueryKey(gameId));
  return mergeOperatorGamePayload(shell, queue, details);
}

function writeOperatorPayload(
  queryClient: ReturnType<typeof useQueryClient>,
  gameId: string,
  next: GamePayload,
) {
  const shell = queryClient.getQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId));
  if (shell) {
    queryClient.setQueryData<OperatorShellPayload>(operatorShellQueryKey(gameId), {
      game: { ...shell.game, status: next.game.status },
    });
  }
  queryClient.setQueryData<OperatorQueuePayload>(operatorQueueQueryKey(gameId), {
    status: next.game.status,
    queue: next.queue,
    checkedOut: next.checkedOut ?? [],
    courts: next.courts,
  });
  queryClient.setQueryData<OperatorDetailsPayload>(operatorDetailsQueryKey(gameId), {
    leaderboard: next.leaderboard ?? [],
    matches: next.matches ?? [],
    recap: next.recap,
    qr:
      next.game.registerUrl && next.game.publicQrCodeDataUrl
        ? {
            registerUrl: next.game.registerUrl,
            publicQrCodeDataUrl: next.game.publicQrCodeDataUrl,
          }
        : undefined,
  });
}

async function getSpectateGame(id: string, scope: "live" | "details") {
  const response = await fetch(`/api/games/${id}/spectate?scope=${scope}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data as SpectateLivePayload | SpectateDetailsPayload;
}

/** Instant UI while the fill-court API request is in flight. */
function applyFillNextCourtOptimistic(payload: GamePayload): GamePayload | null {
  if (payload.queue.length < 4) return null;

  const emptyCourt = [...payload.courts]
    .filter((court) => court.status === "empty")
    .sort((a, b) => a.courtNumber - b.courtNumber)[0];
  if (!emptyCourt) return null;

  const nextFour = payload.queue.slice(0, 4);
  const startedAt = new Date().toISOString();

  return {
    ...payload,
    queue: payload.queue.slice(4),
    courts: payload.courts.map((court) =>
      court.courtNumber === emptyCourt.courtNumber
        ? {
            ...court,
            status: "active",
            startedAt,
            isRematch: false,
            teamA: { playerIds: nextFour.slice(0, 2).map((entry) => entry.playerId) },
            teamB: { playerIds: nextFour.slice(2, 4).map((entry) => entry.playerId) },
          }
        : court,
    ),
  };
}

type EndGameMutationInput = {
  courtNumber: number;
  winnerTeam: "A" | "B";
  teamAScore: number;
  teamBScore: number;
  rematch: boolean;
};

function buildOptimisticRequeueEntries(
  teamA: PlayerPhotoRef[],
  teamB: PlayerPhotoRef[],
  winnerTeam: "A" | "B",
  baseTime: number,
): QueueEntryView[] {
  const slots = [
    { player: teamA[0], team: "A" as const },
    { player: teamB[0], team: "B" as const },
    { player: teamA[1], team: "A" as const },
    { player: teamB[1], team: "B" as const },
  ].filter((slot): slot is { player: PlayerPhotoRef; team: "A" | "B" } => Boolean(slot.player));

  return slots.map((slot, index) => {
    const isWinner = slot.team === winnerTeam;
    return {
      _id: `optimistic-requeue-${baseTime}-${index}`,
      queueType: isWinner ? "winner" : "loser",
      playerId: slot.player,
      registeredAt: new Date(baseTime + index).toISOString(),
      lastMatchResult: isWinner ? "win" : "loss",
    };
  });
}

/** Instant UI while the end-game API request is in flight. */
function applyEndGameOptimistic(
  payload: GamePayload,
  input: EndGameMutationInput,
): GamePayload | null {
  const court = payload.courts.find((c) => c.courtNumber === input.courtNumber);
  if (!court || court.status !== "active") return null;

  if (input.rematch) {
    return {
      ...payload,
      courts: payload.courts.map((c) =>
        c.courtNumber === input.courtNumber
          ? { ...c, startedAt: new Date().toISOString(), isRematch: true }
          : c,
      ),
    };
  }

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  if (teamA.length + teamB.length < 4) return null;

  const baseTime = Date.now();
  const requeueEntries = buildOptimisticRequeueEntries(
    teamA,
    teamB,
    input.winnerTeam,
    baseTime,
  );

  return {
    ...payload,
    queue: [...payload.queue, ...requeueEntries],
    courts: payload.courts.map((c) =>
      c.courtNumber === input.courtNumber
        ? {
            ...c,
            status: "empty",
            startedAt: null,
            isRematch: false,
            teamA: { playerIds: [] },
            teamB: { playerIds: [] },
          }
        : c,
    ),
  };
}

function isPlayerOnActiveCourt(courts: CourtView[], playerId: string): boolean {
  return courts.some(
    (court) =>
      court.status === "active" &&
      [...(court.teamA?.playerIds ?? []), ...(court.teamB?.playerIds ?? [])].some(
        (player) => resolvePlayerId(player) === playerId,
      ),
  );
}

function leaderboardRowPlayerId(row: LeaderboardGamesPlayedRow): string | null {
  const playerId = row.playerId;
  if (playerId == null) return null;
  if (typeof playerId === "object" && "_id" in playerId && playerId._id != null) {
    return String(playerId._id);
  }
  return String(playerId);
}

/** Instant UI while checkout API request is in flight. */
function applyCheckoutOptimistic(payload: GamePayload, queueEntryId: string): GamePayload | null {
  const entry = payload.queue.find((item) => item._id === queueEntryId);
  if (!entry) return null;

  const checkedOutAt = new Date().toISOString();
  return {
    ...payload,
    queue: payload.queue.filter((item) => item._id !== queueEntryId),
    checkedOut: [{ ...entry, checkedOutAt }, ...(payload.checkedOut ?? [])],
  };
}

/** Instant UI while remove-player API request is in flight. */
function applyRemovePlayerOptimistic(payload: GamePayload, playerId: string): GamePayload | null {
  if (isPlayerOnActiveCourt(payload.courts, playerId)) return null;

  const withoutPlayer = (entries: QueueEntryView[]) =>
    entries.filter((entry) => queueEntryPlayerId(entry) !== playerId);

  const matchIncludesPlayer = (match: MatchHistoryView) =>
    match.teamAPlayerIds.some((player) => player._id === playerId) ||
    match.teamBPlayerIds.some((player) => player._id === playerId);

  return {
    ...payload,
    queue: withoutPlayer(payload.queue),
    checkedOut: withoutPlayer(payload.checkedOut ?? []),
    courts: payload.courts.map((court) => ({
      ...court,
      teamA: {
        playerIds: court.teamA.playerIds.filter(
          (player) => resolvePlayerId(player) !== playerId,
        ),
      },
      teamB: {
        playerIds: court.teamB.playerIds.filter(
          (player) => resolvePlayerId(player) !== playerId,
        ),
      },
    })),
    matches: payload.matches.filter((match) => !matchIncludesPlayer(match)),
    leaderboard: payload.leaderboard?.filter(
      (row) => leaderboardRowPlayerId(row) !== playerId,
    ),
  };
}

type ReplaceQueueMutationInput = {
  sourceIndex: number;
  targetIndex: number;
};

type ReplaceCourtMutationInput = {
  courtNumber: number;
  team: "A" | "B";
  slotIndex: number;
  targetIndex: number;
};

function swapQueueEntriesAt(
  queue: QueueEntryView[],
  sourceIndex: number,
  targetIndex: number,
): QueueEntryView[] {
  const next = [...queue];
  const sourceRegisteredAt = next[sourceIndex].registeredAt;
  const targetRegisteredAt = next[targetIndex].registeredAt;
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
  next[sourceIndex] = { ...next[sourceIndex], registeredAt: sourceRegisteredAt };
  next[targetIndex] = { ...next[targetIndex], registeredAt: targetRegisteredAt };
  return next;
}

/** Instant UI while swapping a next-up player with the waiting line. */
function applyQueueSwapOptimistic(
  payload: GamePayload,
  input: ReplaceQueueMutationInput,
): GamePayload | null {
  const { sourceIndex, targetIndex } = input;
  if (sourceIndex < 0 || sourceIndex > 3) return null;
  if (targetIndex < 4 || targetIndex >= payload.queue.length) return null;
  if (sourceIndex === targetIndex) return null;

  return {
    ...payload,
    queue: swapQueueEntriesAt(payload.queue, sourceIndex, targetIndex),
  };
}

/** Instant UI while swapping an on-court player with someone in the queue. */
function applyCourtReplaceOptimistic(
  payload: GamePayload,
  input: ReplaceCourtMutationInput,
): GamePayload | null {
  const { courtNumber, team, slotIndex, targetIndex } = input;
  if (slotIndex < 0 || slotIndex > 1) return null;

  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;
  if (targetIndex < 0 || targetIndex >= payload.queue.length) return null;

  const teamPlayers = team === "A" ? court.teamA.playerIds : court.teamB.playerIds;
  if (slotIndex >= teamPlayers.length) return null;

  const courtPlayer = teamPlayers[slotIndex];
  const queuedEntry = payload.queue[targetIndex];
  if (!courtPlayer || !queuedEntry) return null;

  const requeuedEntry: QueueEntryView = {
    _id: `optimistic-court-replace-${Date.now()}`,
    queueType: "normal",
    playerId: courtPlayer,
    registeredAt: queuedEntry.registeredAt,
    lastMatchResult: "none",
  };

  return {
    ...payload,
    queue: payload.queue.map((entry, index) =>
      index === targetIndex ? requeuedEntry : entry,
    ),
    courts: payload.courts.map((item) => {
      if (item.courtNumber !== courtNumber) return item;
      if (team === "A") {
        const playerIds = [...item.teamA.playerIds];
        playerIds[slotIndex] = queuedEntry.playerId;
        return { ...item, teamA: { playerIds } };
      }
      const playerIds = [...item.teamB.playerIds];
      playerIds[slotIndex] = queuedEntry.playerId;
      return { ...item, teamB: { playerIds } };
    }),
  };
}

/** Instant UI while cancelling a court assignment API request is in flight. */
function applyCancelCourtAssignmentOptimistic(
  payload: GamePayload,
  courtNumber: number,
): GamePayload | null {
  const court = payload.courts.find(
    (item) => item.courtNumber === courtNumber && item.status === "active",
  );
  if (!court) return null;

  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  const courtPlayers = [teamA[0], teamA[1], teamB[0], teamB[1]].filter(Boolean);
  if (courtPlayers.length < 4) return null;

  const firstQueuedMs =
    payload.queue.length > 0
      ? new Date(payload.queue[0].registeredAt).getTime()
      : Date.now();
  const startMs = firstQueuedMs - courtPlayers.length * 1000;

  const requeuedEntries: QueueEntryView[] = courtPlayers.map((player, index) => ({
    _id: `optimistic-cancel-court-${startMs}-${index}`,
    queueType: "normal",
    playerId: player,
    registeredAt: new Date(startMs + index * 1000).toISOString(),
    lastMatchResult: "none",
  }));

  return {
    ...payload,
    queue: [...requeuedEntries, ...payload.queue],
    courts: payload.courts.map((item) =>
      item.courtNumber === courtNumber
        ? {
            ...item,
            status: "empty",
            startedAt: null,
            isRematch: false,
            teamA: { playerIds: [] },
            teamB: { playerIds: [] },
          }
        : item,
    ),
  };
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
  const [callingNames, setCallingNames] = useState(false);
  const [waitingLineView, setWaitingLineView] = useState<WaitingLineViewMode>("list");
  const [showCheckedOutList, setShowCheckedOutList] = useState(true);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showCourts, setShowCourts] = useState(true);
  const [mobileDashboardTab, setMobileDashboardTab] = useState<DashboardMobileTab>("queue");
  const [uiPrefsHydrated, setUiPrefsHydrated] = useState(false);
  const [isLgViewport, setIsLgViewport] = useState<boolean | null>(null);
  const [matchHistoryScope, setMatchHistoryScope] = useState<MatchHistoryScope>("mine");
  const [replaceDialog, setReplaceDialog] = useState<ReplacePlayerDialogState | null>(null);
  const [fillCourtDialogOpen, setFillCourtDialogOpen] = useState(false);
  const [cancelCourtTarget, setCancelCourtTarget] = useState<number | null>(null);
  const [cancelRematchTarget, setCancelRematchTarget] = useState<number | null>(null);
  const [rematchCourtNumbers, setRematchCourtNumbers] = useState<Set<number>>(
    () => new Set(),
  );
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogLoading, setQrDialogLoading] = useState(false);
  const [qrDialogData, setQrDialogData] = useState<{
    registerUrl: string;
    publicQrCodeDataUrl: string;
  } | null>(null);
  const openQrRegistrationDialog = async () => {
    setQrDialogLoading(true);
    try {
      const canProceed = await promptIfRegistrationFull(gameId);
      if (!canProceed) return;

      if (!qrDialogData) {
        const response = await fetch(`/api/games/${gameId}/qr`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);
        setQrDialogData({
          registerUrl: payload.registerUrl,
          publicQrCodeDataUrl: payload.publicQrCodeDataUrl,
        });
      }

      setQrDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check registration status.");
    } finally {
      setQrDialogLoading(false);
    }
  };

  useEffect(() => {
    setShowWaitingList(loadShowWaitingList());
    setWaitingLineView(loadWaitingLineViewMode());
    setShowCheckedOutList(loadShowCheckedOutList());
    setShowMatchHistory(loadShowMatchHistory());
    setShowCourts(loadShowCourts());
    setUiPrefsHydrated(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(GAME_QUEUE_DESKTOP_MEDIA);
    const apply = () => setIsLgViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const {
    leaseState: operatorLeaseState,
    checkAgain: checkOperatorDashboardLease,
    takeOver: takeOverOperatorDashboard,
    hasDashboardLease,
  } = useOperatorDashboardLease(gameId, !isSpectator);

  const operatorShellQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    enabled: !!gameId && !isSpectator && hasDashboardLease,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const operatorQueueQuery = useQuery({
    queryKey: operatorQueueQueryKey(gameId),
    queryFn: () => fetchOperatorQueue(gameId),
    enabled: !!gameId && !isSpectator && hasDashboardLease && Boolean(operatorShellQuery.data),
    refetchOnWindowFocus: false,
  });

  const operatorWantsMatchDetails =
    !isSpectator && (showMatchHistory || mobileDashboardTab === "history");

  const operatorDetailsQuery = useQuery({
    queryKey: operatorDetailsQueryKey(gameId),
    queryFn: () => fetchOperatorDetails(gameId),
    enabled: !!gameId && Boolean(operatorShellQuery.data) && operatorWantsMatchDetails,
    refetchOnWindowFocus: false,
  });

  useOperatorQueueRegistrationSync({
    gameId,
    enabled:
      !!gameId &&
      !isSpectator &&
      hasDashboardLease &&
      operatorQueueQuery.data?.status !== "ended" &&
      operatorQueueQuery.data?.status !== "draft",
    queueQuery: operatorQueueQuery,
    detailsQuery: operatorDetailsQuery,
    refreshDetails: operatorWantsMatchDetails,
  });

  const spectatorLiveQuery = useQuery({
    queryKey: ["game", gameId, "spectator", "live"],
    queryFn: () => getSpectateGame(gameId, "live") as Promise<SpectateLivePayload>,
    enabled: !!gameId && isSpectator,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !isSpectatorGameNotFoundError(error) && failureCount < 8,
    retryDelay: (attempt) => Math.min(750 * (attempt + 1), 5_000),
    refetchInterval: (query) => {
      const status = query.state.data?.game?.status;
      if (status === "ended") return false;
      return SPECTATOR_LIVE_POLL_MS;
    },
  });

  const spectatorGameStatus = spectatorLiveQuery.data?.game?.status;
  const spectatorWantsDetails =
    isSpectator &&
    (spectatorGameStatus === "ended" ||
      showMatchHistory ||
      mobileDashboardTab === "history");

  const spectatorDetailsQuery = useQuery({
    queryKey: ["game", gameId, "spectator", "details"],
    queryFn: () => getSpectateGame(gameId, "details") as Promise<SpectateDetailsPayload>,
    enabled: !!gameId && spectatorWantsDetails,
    refetchOnWindowFocus: false,
  });

  const data = useMemo((): GamePayload | undefined => {
    if (isSpectator) {
      if (!spectatorLiveQuery.data) return undefined;
      return mergeSpectatorGamePayload(
        spectatorLiveQuery.data,
        spectatorDetailsQuery.data,
      ) as GamePayload;
    }
    if (!operatorShellQuery.data) return undefined;
    return mergeOperatorGamePayload(
      operatorShellQuery.data,
      operatorQueueQuery.data,
      operatorDetailsQuery.data,
    );
  }, [
    isSpectator,
    operatorDetailsQuery.data,
    operatorQueueQuery.data,
    operatorShellQuery.data,
    spectatorDetailsQuery.data,
    spectatorLiveQuery.data,
  ]);

  const isLoading = isSpectator
    ? spectatorLiveQuery.isLoading
    : operatorShellQuery.isLoading || operatorQueueQuery.isLoading;
  const error = isSpectator ? spectatorLiveQuery.error : operatorShellQuery.error ?? operatorQueueQuery.error;

  useSpectatorSessionCleanup(gameId, isSpectator);


  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyFillNextCourtOptimistic(previous);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Next court filled from the queue.");
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      toast.error(error.message);
    },
  });

  const closeEndDialog = () => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  };

  const endMutation = useMutation({
    mutationFn: async (input: EndGameMutationInput) => {
      const response = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message?: string; rematch?: boolean };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyEndGameOptimistic(previous, variables);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);

      const previousRematchCourtNumbers = new Set(rematchCourtNumbers);
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

      return { previous, previousRematchCourtNumbers };
    },
    onSuccess: (data, variables) => {
      toast.success(data.message ?? "Court updated.");
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      void announceCourtEnded(variables.courtNumber, {
        onStart: () => setCallingNames(false),
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      if (context?.previousRematchCourtNumbers) {
        setRematchCourtNumbers(context.previousRematchCourtNumbers);
      }
      toast.error(error.message);
    },
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
    onMutate: async (courtNumber) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCancelCourtAssignmentOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);

      const previousRematchCourtNumbers = new Set(rematchCourtNumbers);
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      setCancelCourtTarget(null);

      return { previous, previousRematchCourtNumbers };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error, _courtNumber, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      if (context?.previousRematchCourtNumbers) {
        setRematchCourtNumbers(context.previousRematchCourtNumbers);
      }
      toast.error(error.message);
    },
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
    mutationFn: async (input: ReplaceQueueMutationInput) => {
      const response = await fetch(`/api/games/${gameId}/swap-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyQueueSwapOptimistic(previous, variables);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      toast.error(error.message);
    },
  });

  const replaceCourtMutation = useMutation({
    mutationFn: async (input: ReplaceCourtMutationInput) => {
      const response = await fetch(`/api/games/${gameId}/replace-court-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCourtReplaceOptimistic(previous, variables);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      toast.error(error.message);
    },
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
      playerName?: string;
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
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCheckoutOptimistic(previous, variables.queueEntryId);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (payload, variables) => {
      if (gameId) {
        removeActiveQueueHighlightPlayerId(gameId, variables.checkedOutPlayerId);
      }
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      if (!isSpectator && gameId && variables.playerName) {
        dispatchSpectatorCheckoutNotification(gameId, {
          id: variables.queueEntryId,
          kind: "checkout",
          playerName: variables.playerName,
          checkedOutAt: new Date().toISOString(),
        });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      toast.error(error.message);
    },
  });

  const removePlayerFromGameMutation = useMutation({
    mutationFn: async (input: { playerId: string }) => {
      const response = await fetch(`/api/games/${gameId}/remove-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: input.playerId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorPayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyRemovePlayerOptimistic(previous, variables.playerId);
      if (!optimistic) return { previous };

      writeOperatorPayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (payload, variables) => {
      if (gameId) {
        removeActiveQueueHighlightPlayerId(gameId, variables.playerId);
      }
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorPayload(queryClient, gameId, context.previous);
      }
      toast.error(error.message);
    },
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
  });

  const confirmRemoveFromQueue = async (entry: QueueEntryView) => {
    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );
    const isSelfCheckout =
      isSpectator && selfPlayerIds.includes(queueEntryPlayerId(entry));
    const result = await Swal.fire({
      ...alertBaseOptions,
      title: "Check out?",
      html: isSelfCheckout
        ? `<strong>${playerName}</strong>, you will be checked out of the queue, but your registration and match history are kept.`
        : `<strong>${playerName}</strong> will be checked out of the queue. Their registration and match history are kept.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, check out",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    removeMutation.mutate({
      queueEntryId: entry._id,
      checkedOutPlayerId: queueEntryPlayerId(entry),
      selfPlayerIds,
      playerName,
    });
  };

  const confirmCheckBackIn = async (entry: QueueEntryView) => {
    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );

    void Swal.fire({
      ...alertBaseOptions,
      title: "Checking back in…",
      html: `<strong>${playerName}</strong> is rejoining the queue.`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await checkBackInMutation.mutateAsync(entry._id);
      Swal.close();
    } catch (error) {
      Swal.fire({
        ...alertBaseOptions,
        icon: "error",
        title: "Check-in failed",
        text: error instanceof Error ? error.message : "Failed to check player back in.",
        confirmButtonText: "OK",
      });
    }
  };

  const confirmRemovePlayerFromGame = async (entry: QueueEntryView) => {
    const playerId = queueEntryPlayerId(entry);
    if (!playerId) return;

    const playerName = formatPlayerDisplayName(
      entry.playerId.firstName,
      entry.playerId.lastName,
    );

    const result = await Swal.fire({
      ...alertBaseOptions,
      title: "Remove player?",
      html: `<strong>${playerName}</strong> will be removed from this open play entirely (queue, court assignments, and match history).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove player",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    removePlayerFromGameMutation.mutate({ playerId });
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
    if (!uiPrefsHydrated || isLgViewport === null || isLoading || !gameId || !data?.queue?.length) {
      return;
    }
    if (hasQueueHighlightBeenApplied(gameId)) return;

    const fromRegistration = peekQueueHighlightPlayerId(gameId);
    if (!fromRegistration) return;

    const queueIndex = data.queue.findIndex(
      (entry) => queueEntryPlayerId(entry) === fromRegistration,
    );
    if (queueIndex < 0) return;

    persistActiveQueueHighlight(gameId, fromRegistration);

    if (!isLgViewport && mobileDashboardTab !== "queue") {
      setMobileDashboardTab("queue");
      return;
    }

    const inWaitingLine = queueIndex >= 4;
    if (inWaitingLine) {
      if (!showWaitingList) {
        setShowWaitingList(true);
        saveShowWaitingList(true);
        return;
      }
      if (waitingLineView !== "list") {
        setWaitingLineView("list");
        saveWaitingLineViewMode("list");
        return;
      }
    }

    const entry = data.queue[queueIndex];
    const delayMs = inWaitingLine ? 500 : 300;
    const timers: number[] = [];

    const finishHighlightScroll = () => {
      markQueueHighlightApplied(gameId);
      clearQueueHighlightPlayerId(gameId);
    };

    const attemptScroll = (attempt: number) => {
      if (scrollToQueueEntry(entry._id)) {
        finishHighlightScroll();
        return;
      }
      if (attempt >= 16) {
        finishHighlightScroll();
        return;
      }
      timers.push(window.setTimeout(() => attemptScroll(attempt + 1), 175));
    };

    timers.push(window.setTimeout(() => attemptScroll(1), delayMs));

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [
    uiPrefsHydrated,
    isLgViewport,
    isLoading,
    gameId,
    data?.queue,
    showWaitingList,
    waitingLineView,
    mobileDashboardTab,
  ]);

  const readOnly = isSpectator;
  const loadingLabel = "Loading game dashboard...";

  if (isSpectator && !spectatorLiveQuery.data) {
    if (
      spectatorLiveQuery.isError &&
      !spectatorLiveQuery.isFetching &&
      isSpectatorGameNotFoundError(spectatorLiveQuery.error)
    ) {
      return (
        <main className="game-dashboard--spectator flex min-h-screen items-center justify-center p-8">
          <p className="text-center text-base text-muted-foreground">This game could not be found.</p>
        </main>
      );
    }

    return <SpectatorLoadingScreen />;
  }

  if (!isSpectator && operatorLeaseState.status !== "active") {
    return (
      <OperatorDashboardLeaseGate
        loading={operatorLeaseState.status === "loading"}
        deviceHint={
          operatorLeaseState.status === "blocked" ? operatorLeaseState.deviceHint : undefined
        }
        lastSeenAt={
          operatorLeaseState.status === "blocked" ? operatorLeaseState.lastSeenAt : undefined
        }
        takenOver={
          operatorLeaseState.status === "blocked" ? operatorLeaseState.takenOver : undefined
        }
        onCheckAgain={() => void checkOperatorDashboardLease()}
        onTakeOver={() => void takeOverOperatorDashboard()}
        checking={operatorLeaseState.status === "loading"}
      />
    );
  }

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

  const spectatorMatchHistory =
    !isSpectator || matchHistoryScope === "all"
      ? matches
      : filterMatchesForViewer(matches, selfPlayerIds);

  const operatorMatchHistoryCaption = (() => {
    if (!showMatchHistory) return "Expand to view match history";
    if (operatorDetailsQuery.isLoading && !operatorDetailsQuery.data) {
      return "Loading match history…";
    }
    return `${matches.length} ${matches.length === 1 ? "match" : "matches"} recorded`;
  })();

  const spectatorMatchHistoryPanelOpen =
    showMatchHistory || (isSpectator && isLgViewport === false && mobileDashboardTab === "history");

  const spectatorMatchHistoryCaption = (() => {
    if (!isSpectator) {
      return operatorMatchHistoryCaption;
    }
    if (!spectatorMatchHistoryPanelOpen && game.status !== "ended") {
      return "Expand to view match history";
    }
    if (spectatorDetailsQuery.isLoading && !spectatorDetailsQuery.data) {
      return "Loading match history…";
    }
    if (matchHistoryScope === "all") {
      return `${matches.length} ${matches.length === 1 ? "match" : "matches"} recorded`;
    }
    if (selfPlayerIds.length === 0) {
      return "Register for this game to see your matches";
    }
    const mineCount = spectatorMatchHistory.length;
    if (matches.length === mineCount) {
      return `${mineCount} ${mineCount === 1 ? "match" : "matches"} with you`;
    }
    return `${mineCount} of ${matches.length} matches with you`;
  })();

  const spectatorMatchHistoryEmptyMessage =
    matchHistoryScope === "all"
      ? "No matches recorded for this session yet."
      : selfPlayerIds.length === 0
        ? "Register for this open play to link your player and see matches you played here."
        : "You have not played a match in this session yet.";

  const leaderboardHref = isSpectator
    ? `/leaderboard/${game.gameId}?from=spectator`
    : `/leaderboard/${game.gameId}`;

  const isCourtRematch = (court: CourtView) =>
    court.isRematch === true || rematchCourtNumbers.has(court.courtNumber);

  const openPlayDateLabel = formatOpenPlayDate(game.openPlayDate);
  const openPlayTimeLabel = game.openPlayTimeRange?.trim() || null;
  const isPastGame = game.status === "ended";
  const showSpectatorEndedRecap = isSpectator && isPastGame;
  const canResetGame = isDemoOpenPlayTitle(game.title);
  const hideControls = readOnly || isPastGame;
  const canReorderQueue =
    !hideControls && queueWithStats.length >= 2 && !reorderQueueMutation.isPending;
  const queueEntryIds = queueWithStats.map((entry) => entry._id);
  const canCheckoutFromQueue = !isPastGame;
  const showOperatorMobileNav = !showSpectatorEndedRecap && !isSpectator;
  const showQrRegistration = !readOnly && !isPastGame && game.allowQrRegistration !== false;
  const resolvedQrDialogData =
    qrDialogData ??
    (game.registerUrl && game.publicQrCodeDataUrl
      ? { registerUrl: game.registerUrl, publicQrCodeDataUrl: game.publicQrCodeDataUrl }
      : null);

  const handleEndOpenPlay = async () => {
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
  };

  const handleResetGame = async () => {
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
  };

  const renderQueueEntryRow = (
    entry: QueueEntryView,
    index: number,
    drag?: QueueDragHandleProps,
    options?: { compactName?: boolean },
  ) => {
    const isNextUp = index < 4;
    return (
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
        onRemove={canRemoveEntry(entry) ? () => confirmRemoveFromQueue(entry) : undefined}
        removePending={
          canRemoveEntry(entry) &&
          removeMutation.isPending &&
          removeMutation.variables?.queueEntryId === entry._id
        }
        onRemovePlayer={
          !hideControls && queueEntryPlayerId(entry)
            ? () => confirmRemovePlayerFromGame(entry)
            : undefined
        }
        removePlayerPending={
          removePlayerFromGameMutation.isPending &&
          removePlayerFromGameMutation.variables?.playerId === queueEntryPlayerId(entry)
        }
        highlighted={
          selfHighlightPlayerId != null &&
          queueEntryPlayerId(entry) === selfHighlightPlayerId
        }
        compactName={options?.compactName}
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

  const renderQueuedEntry = (
    entry: QueueEntryView,
    index: number,
    options?: { sortable?: boolean; compactName?: boolean },
  ) => {
    if (options?.sortable === false) {
      return (
        <div key={entry._id}>{renderQueueEntryRow(entry, index, undefined, options)}</div>
      );
    }

    return (
      <SortableQueueItem key={entry._id} id={entry._id} enabled={canReorderQueue}>
        {(drag) => renderQueueEntryRow(entry, index, drag, options)}
      </SortableQueueItem>
    );
  };

  const sortableQueueEntryIds =
    waitingLineView === "list" ? queueEntryIds : queueEntryIds.slice(0, 4);
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

  const activeCourtCount = courts.filter((court) => court.status === "active").length;

  const startPlayerAnnouncement = (
    teamA: QueueEntryView[],
    teamB: QueueEntryView[],
  ) => {
    if (callingNames) return;

    setCallingNames(true);
    void announceNextCourtPlayers(
      teamA.map((entry) => entry.playerId),
      teamB.map((entry) => entry.playerId),
      {
        courtNumber: nextEmptyCourt?.courtNumber ?? null,
        onComplete: () => setCallingNames(false),
      },
    ).then((started) => {
      if (!started) {
        setCallingNames(false);
        toast.error("Text-to-speech is not available in this browser.");
      }
    });
  };

  const handleCallNextNames = () => {
    startPlayerAnnouncement(fillCourtTeamA, fillCourtTeamB);
  };

  const renderQueuePanel = () => (
    <Card className="glass-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle>Queue</CardTitle>
          {isSpectator && !isPastGame ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="queue-refresh-btn h-8 w-8 shrink-0 px-0"
              onClick={() => void spectatorLiveQuery.refetch()}
              disabled={spectatorLiveQuery.isFetching}
              aria-label="Refresh queue"
            >
              <RefreshCw
                className={cn("h-4 w-4", spectatorLiveQuery.isFetching && "animate-spin")}
              />
            </Button>
          ) : !hideControls ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="queue-refresh-btn h-8 w-8 shrink-0 px-0"
              onClick={() => void operatorQueueQuery.refetch()}
              disabled={operatorQueueQuery.isFetching}
              aria-label="Refresh queue"
            >
              <RefreshCw
                className={cn("h-4 w-4", operatorQueueQuery.isFetching && "animate-spin")}
              />
            </Button>
          ) : null}
        </div>
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
                entryIds={sortableQueueEntryIds}
                enabled={canReorderQueue}
                onReorder={(orderedEntryIds) => reorderQueueMutation.mutate(orderedEntryIds)}
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
                          {Math.min(4, queueWithStats.length) === 1 ? "player" : "players"} — ready to
                          play
                          {canReorderQueue ? " · drag to reorder" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!hideControls ? (
                        <Button
                          type="button"
                          size="sm"
                          className={cn(
                            "call-names-btn h-8 shrink-0 px-3 text-xs tracking-wide xl:h-9 xl:px-4 xl:text-sm",
                            callingNames && "call-names-btn--calling",
                            nextEmptyCourt != null && !callingNames && "call-names-btn--glow",
                          )}
                          onClick={handleCallNextNames}
                          disabled={callingNames}
                          aria-label="Call next player names aloud"
                        >
                          <Volume2 className="call-names-btn-icon mr-1.5 h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden />
                          {callingNames ? "Calling…" : "Call Names"}
                        </Button>
                      ) : null}
                      <Badge className="badge-next-up-count">
                        {Math.min(4, queueWithStats.length)} / 4
                      </Badge>
                    </div>
                  </div>
                  <div className="queue-next-up-slots">
                    {queueWithStats.slice(0, 4).map((entry, index) => renderQueuedEntry(entry, index))}
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
                      {showWaitingList ? (
                        <div className="queue-waiting-view-bar mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <WaitingLineViewToggle
                            view={waitingLineView}
                            onViewChange={(mode) => {
                              setWaitingLineView(mode);
                              saveWaitingLineViewMode(mode);
                            }}
                          />
                          {waitingLineView === "group" && canReorderQueue ? (
                            <p className="caption text-muted-foreground">
                              Switch to list view to drag and reorder.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div id="queue-waiting-list" className={cn(!showWaitingList && "hidden")}>
                      {waitingLineView === "list" ? (
                        <div className="space-y-2">
                          {waitingLineEntries.map((entry, offset) =>
                            renderQueuedEntry(entry, offset + 4),
                          )}
                        </div>
                      ) : (
                        <WaitingLineGroupView
                          waitingEntries={waitingLineEntries}
                          renderEntry={(entry, queueIndex) =>
                            renderQueuedEntry(entry, queueIndex, {
                              sortable: false,
                              compactName: true,
                            })
                          }
                        />
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
                onCheckBackIn={(entry) => confirmCheckBackIn(entry)}
                checkBackInPendingId={
                  checkBackInMutation.isPending
                    ? (checkBackInMutation.variables ?? null)
                    : null
                }
                onRemovePlayer={(entry) => confirmRemovePlayerFromGame(entry)}
                removePlayerPendingId={
                  removePlayerFromGameMutation.isPending
                    ? (removePlayerFromGameMutation.variables?.playerId ?? null)
                    : null
                }
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );

  const renderCourtsPanel = (inSpectatorMobileTab = false) => (
    <Card className="glass-panel courts-panel">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Courts</CardTitle>
          <CourtsSummary courts={courts} />
        </div>
        {!inSpectatorMobileTab && !isSpectator ? (
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
        ) : null}
      </CardHeader>
      <CardContent
        id={inSpectatorMobileTab ? "courts-list-mobile" : "courts-list"}
        className={cn(
          "court-grid court-grid--list grid grid-cols-1 gap-3",
          !inSpectatorMobileTab && !showCourts && "hidden lg:grid",
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
              swapCourtMutation.isPending && swapCourtMutation.variables === court.courtNumber
            }
            onCancelAssignment={
              hideControls || court.status !== "active" || isCourtRematch(court)
                ? undefined
                : () => setCancelCourtTarget(court.courtNumber)
            }
            cancelPending={
              cancelCourtMutation.isPending &&
              cancelCourtMutation.variables === court.courtNumber
            }
            onCancelRematch={
              hideControls || court.status !== "active" || !isCourtRematch(court)
                ? undefined
                : () => setCancelRematchTarget(court.courtNumber)
            }
            cancelRematchPending={
              cancelRematchMutation.isPending &&
              cancelRematchMutation.variables === court.courtNumber
            }
            isFilling={fillingCourtNumber != null && court.courtNumber === fillingCourtNumber}
          />
        ))}
      </CardContent>
    </Card>
  );

  const renderMatchHistoryPanel = (inSpectatorMobileTab = false) => {
    const historyMatches = isSpectator ? spectatorMatchHistory : matches;
    const panelVisible = inSpectatorMobileTab || showMatchHistory;
    const detailsQuery = isSpectator ? spectatorDetailsQuery : operatorDetailsQuery;

    return (
      <Card className="glass-panel match-history-panel">
        <CardHeader className="flex flex-col gap-3">
          <div className="match-history-panel-header flex w-full flex-nowrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>Match History</CardTitle>
              <p className="caption">{spectatorMatchHistoryCaption}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
              {panelVisible ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="match-history-refresh"
                  onClick={() => void detailsQuery.refetch()}
                  disabled={detailsQuery.isFetching}
                  aria-label="Refresh match history"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", detailsQuery.isFetching && "animate-spin")}
                  />
                </Button>
              ) : null}
              {!inSpectatorMobileTab ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="match-history-toggle"
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
              ) : null}
            </div>
          </div>
          {isSpectator && panelVisible ? (
            <MatchHistoryScopeToggle
              scope={matchHistoryScope}
              onScopeChange={setMatchHistoryScope}
            />
          ) : null}
        </CardHeader>
        {panelVisible ? (
          <CardContent id={inSpectatorMobileTab ? "match-history-list-mobile" : "match-history-list"}>
            {detailsQuery.isLoading && !detailsQuery.data ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading match history…
              </div>
            ) : (
              <MatchHistoryList
                key={isSpectator ? matchHistoryScope : "operator"}
                matches={historyMatches}
                gameId={gameId}
                editable={!hideControls}
                showNameFilter={!isSpectator}
                emptyMessage={isSpectator ? spectatorMatchHistoryEmptyMessage : undefined}
              />
            )}
          </CardContent>
        ) : null}
      </Card>
    );
  };

  return (
    <GamePlayerProfileProvider profileEnabled={!isSpectator}>
    <main
      className={cn(
        "relative min-h-screen p-4 md:p-6",
        isSpectator ? "game-dashboard--spectator" : "game-dashboard--operator",
        showOperatorMobileNav && "pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-6",
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
          <CardContent className="game-dashboard-header-content relative">
            {!showSpectatorEndedRecap ? (
              <div className="game-dashboard-header-actions">
                {!isSpectator ? <GameCheckoutNotificationBell gameId={gameId} /> : null}
                <Link
                  href={leaderboardHref}
                  className="game-dashboard-header-leaderboard group/leaderboard inline-flex rounded-lg"
                >
                  <Button
                    size="sm"
                    variant="default"
                    aria-label="Leaderboard"
                    className="game-dashboard-leaderboard-btn h-8 gap-1 px-2 text-xs font-semibold shadow-md sm:gap-1.5 sm:px-2.5 lg:h-11 lg:gap-2 lg:px-5 lg:text-base"
                  >
                    <Trophy
                      className="game-dashboard-leaderboard-icon h-3.5 w-3.5 shrink-0 lg:h-5 lg:w-5"
                      aria-hidden
                    />
                    <span className="hidden sm:inline">Leaderboard</span>
                  </Button>
                </Link>
              </div>
            ) : null}
            <div className="game-dashboard-header-top">
              <div className="game-dashboard-header-main min-w-0">
                <h1 className={cn("page-title", isSpectator && "mb-[13px]")}>{game.title}</h1>
                {isSpectator && showSpectatorEndedRecap ? (
                  <p className="caption mt-1 text-muted-foreground">
                    Session ended — view awards, standings, and match history below
                  </p>
                ) : null}
              </div>
              <div className="game-dashboard-meta">
                <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
                  {game.openPlayType}
                </Badge>
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
                {game.status === "ended" ? (
                  <Badge variant="destructive" className="game-dashboard-meta-badge w-fit">
                    Status: ended
                  </Badge>
                ) : null}
              </div>
            </div>
            {!showSpectatorEndedRecap && !isSpectator ? (
            <div className="game-toolbar mt-4 hidden flex-wrap items-center gap-2 lg:flex">
              <Link href="/">
                <Button size="lg" variant="outline">
                  <House className="mr-2 h-4 w-4" /> Home
                </Button>
              </Link>
              {showQrRegistration ? (
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
              {!readOnly && !isPastGame ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-destructive/50 text-destructive"
                  onClick={handleEndOpenPlay}
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
                  onClick={handleResetGame}
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
        ) : isLgViewport === true ? (
          <>
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
              {renderQueuePanel()}
              {renderCourtsPanel()}
            </section>
            {renderMatchHistoryPanel()}
          </>
        ) : (
          <div className="dashboard-mobile-tabs mt-2 flex flex-col gap-4">
            <div
              role="tablist"
              aria-label="Game dashboard sections"
              className="dashboard-mobile-tablist grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1.5"
            >
              {(
                [
                  { id: "queue" as const, label: "Queue", count: queueWithStats.length },
                  { id: "courts" as const, label: "Courts", count: activeCourtCount },
                  {
                    id: "history" as const,
                    label: "History",
                    count: (isSpectator ? spectatorDetailsQuery.data : operatorDetailsQuery.data)
                      ? matches.length
                      : undefined,
                  },
                ] as const
              ).map((tab) => {
                const selected = mobileDashboardTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`dashboard-tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`dashboard-panel-${tab.id}`}
                    onClick={() => setMobileDashboardTab(tab.id)}
                    className={cn(
                      "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm",
                      selected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.count != null && tab.count > 0 ? (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] sm:text-xs">
                        {tab.count}
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div
              role="tabpanel"
              id={`dashboard-panel-${mobileDashboardTab}`}
              aria-labelledby={`dashboard-tab-${mobileDashboardTab}`}
            >
              {mobileDashboardTab === "queue"
                ? renderQueuePanel()
                : mobileDashboardTab === "courts"
                  ? renderCourtsPanel(true)
                  : renderMatchHistoryPanel(true)}
            </div>
          </div>
        )}
      </section>

      {!readOnly ? (
        <>
          <FillCourtConfirmDialog
            open={fillCourtDialogOpen}
            onOpenChange={(open) => {
              setFillCourtDialogOpen(open);
              if (!open && callingNames) {
                window.speechSynthesis?.cancel();
                setCallingNames(false);
              }
            }}
            callingNames={callingNames}
            onCallNames={startPlayerAnnouncement}
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
            onConfirm={handleReplaceConfirm}
          />
          <Dialog
            open={cancelCourtTarget !== null}
            onOpenChange={(open) => {
              if (!open) setCancelCourtTarget(null);
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
                <Button type="button" variant="outline" onClick={() => setCancelCourtTarget(null)}>
                  Keep on court
                </Button>
                <Button
                  type="button"
                  disabled={cancelCourtTarget === null}
                  onClick={() => {
                    if (cancelCourtTarget === null) return;
                    cancelCourtMutation.mutate(cancelCourtTarget);
                  }}
                >
                  Yes, cancel assignment
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

      {!readOnly && resolvedQrDialogData ? (
        <GameQrDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          gameTitle={game.title}
          registerUrl={resolvedQrDialogData.registerUrl}
          qrCodeDataUrl={resolvedQrDialogData.publicQrCodeDataUrl}
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
                        onClick={() => setEndGameRematch(false)}
                      >
                        No
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={endGameRematch ? "default" : "outline"}
                        className="end-game-rematch-btn"
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
                    disabled={endGameScoreError != null}
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
                    {endGameRematch ? "Start rematch" : "End game"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : null}

      {showOperatorMobileNav ? (
        <GameDashboardMobileNav
          showQr={showQrRegistration}
          qrLoading={qrDialogLoading}
          onQrClick={openQrRegistrationDialog}
          showEndOpenPlay={!readOnly && !isPastGame}
          endOpenPlayPending={endOpenPlayMutation.isPending}
          onEndOpenPlay={handleEndOpenPlay}
          showReset={!readOnly && canResetGame}
          resetPending={resetMutation.isPending}
          onReset={handleResetGame}
        />
      ) : null}
    </main>
    </GamePlayerProfileProvider>
  );
}
