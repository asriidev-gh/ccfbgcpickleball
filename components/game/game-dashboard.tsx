"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  QrCode,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  House,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  CalendarDays,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  getPublicErrorMessage,
  shouldSuppressUserNotification,
} from "@/lib/infrastructure-error";
import { toastOperationError } from "@/lib/toast-error";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { swalAlertBaseOptions, selfQueueCheckoutMessageHtml } from "@/lib/swal-theme";

import {
  applyAllCourtsPauseOptimistic,
  applyCancelCourtAssignmentOptimistic,
  applyCancelRematchOptimistic,
  applyCheckoutOptimistic,
  applyCheckBackInOptimistic,
  applyCourtPauseOptimistic,
  applyCourtReplaceOptimistic,
  applyEndGameOptimistic,
  applyEndGameWithHistoryOptimistic,
  applyEndOpenPlayOptimistic,
  applyFillNextCourtOptimistic,
  applyQueueReorderOptimistic,
  applyQueueSwapOptimistic,
  applyRemovePlayerOptimistic,
  applyShuffleNextOptimistic,
  applySwapCourtTeamsOptimistic,
  type EndGameMutationInput,
  type GamePayload,
  type ReplaceCourtMutationInput,
  type ReplaceQueueMutationInput,
} from "@/lib/game-payload-mutations";
import {
  getQuickGameDashboardPath,
  isAccountQuickGame,
  isEphemeralQuickGame,
  isQuickGame,
} from "@/lib/local-game-id";
import {
  readOperatorGamePayload,
  seedLocalGameOperatorCache,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";
import { useAccountQuickGameCheckpoint } from "@/hooks/use-account-quick-game-checkpoint";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import {
  ensureAccountQuickGameHydrated,
  saveQuickGameSession,
} from "@/lib/quick-game-persistence-client";
import { readQuickGamePayload } from "@/lib/quick-game-store";
import {
  beginEphemeralQuickGameSaveToAccount,
  promptSaveEphemeralQuickGame,
} from "@/lib/ephemeral-quick-game-transfer";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import { DashboardPanelFullscreenButton } from "@/components/game/dashboard-panel-fullscreen-button";
import { GamePlayerProfileProvider } from "@/components/game/game-player-profile-context";
import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { PlayerAvatar, resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { GameDashboardMobileNav } from "@/components/game/game-dashboard-mobile-nav";
import { SpectateBirthdaysThisMonthBadge } from "@/components/player/spectate-birthdays-this-month";
import { SpectateFirstTimersBadge } from "@/components/player/spectate-first-timers";
import { SpectatorPlayerCardShareButton } from "@/components/game/spectator-player-card-share-button";
import { DatabaseCheckInDialog } from "@/components/game/database-check-in-dialog";
import { AddManualPlayerDialog } from "@/components/game/add-manual-player-dialog";
import { GameSessionActionsMenu } from "@/components/game/game-session-actions-menu";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { promptIfRegistrationFull } from "@/components/game/registration-capacity-prompt";
import {
  MatchHistoryList,
  type MatchHistoryView,
} from "@/components/game/match-history-list";
import { formatOpenPlayDate, formatOpenPlayScheduleLabel } from "@/lib/open-play-time-range";
import { FillCourtFlow, type FillCourtFlowHandle } from "@/components/game/fill-court-flow";
import { SwitchToCourtViewButton } from "@/components/game/switch-to-court-view-button";
import { LiveQueueOffBadge } from "@/components/home/live-queue-off-badge";
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
  GAME_QUEUE_COMPACT_MEDIA,
  GAME_QUEUE_DESKTOP_MEDIA,
  WaitingLineViewToggle,
  loadWaitingLineViewMode,
  saveWaitingLineViewMode,
  type WaitingLineViewMode,
} from "@/components/game/queue-waiting-line-panel";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerLeaderboardRankMap,
  buildPlayerSessionStatsMap,
  type LeaderboardGamesPlayedRow,
} from "@/lib/games-played-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberStepper } from "@/components/ui/number-stepper";
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
  parseEndGameScoreField,
} from "@/lib/match-score-validation";
import { announceCourtEnded } from "@/lib/call-names-speech";
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
  operatorDetailsQueryKey,
  operatorQueueQueryKey,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import {
  mergeOperatorGamePayload,
  type OperatorDetailsPayload,
  type OperatorFullPayload,
  type OperatorQueuePayload,
  type OperatorShellPayload,
} from "@/lib/operator-payload";
import { prefetchLeaderboardRecap } from "@/lib/fetch-leaderboard";
import {
  fetchSpectateGame,
  isSpectatorViewUnavailableError,
  spectatorDetailsQueryKey,
  spectatorLiveQueryKey,
} from "@/lib/fetch-spectate-game";
import { SPECTATOR_LIVE_POLL_MS } from "@/lib/spectator-polling";
import { SPECTATOR_VIEW_UNAVAILABLE_MESSAGE } from "@/lib/spectator-availability-shared";

export type GameDashboardMode = "operator" | "spectator";

type DashboardMobileTab = "queue" | "courts" | "history";

const alertBaseOptions = swalAlertBaseOptions;

const WAITING_LIST_STORAGE_KEY = "ccf-queue-waiting-visible";
const CHECKED_OUT_LIST_STORAGE_KEY = "ccf-queue-checked-out-visible";
const MATCH_HISTORY_STORAGE_KEY = "ccf-match-history-visible";
const COURTS_STORAGE_KEY = "ccf-courts-visible";
const CHECKED_OUT_PREVIEW_COUNT = 2;

function isSpectatorGameNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /not found/i.test(message);
}

function getSpectatorPanelRefreshStatus(
  isFetching: boolean,
  isLoading: boolean,
  isManualRefresh: boolean,
) {
  if (!isFetching || isLoading) return null;
  return isManualRefresh ? "Refreshing data..." : "Auto sync in-progress..";
}

function SpectatorUnavailableScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <main className="game-dashboard--spectator flex min-h-screen items-center justify-center p-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-base font-medium text-foreground">{SPECTATOR_VIEW_UNAVAILABLE_MESSAGE}</p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </main>
  );
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

function DashboardPanelLoading({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

function operatorPlaceholderShell(gameId: string): OperatorShellPayload {
  return {
    game: {
      title: "Loading session…",
      gameId,
      openPlayType: "—",
      courtCount: 0,
      status: "active",
    },
  };
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
  gameId: string;
  entries: QueueEntryView[];
  expanded: boolean;
  onToggle: () => void;
  onCheckBackIn: (entry: QueueEntryView) => void;
  checkBackInPendingId: string | null;
  onRemovePlayer?: (entry: QueueEntryView) => void;
  removePlayerPendingId?: string | null;
  allowCheckInAsPlayer?: boolean;
  onViewPlayerInfo?: (entry: QueueEntryView) => void;
  showLeaderboardRank?: boolean;
  leaderboardRankMap?: Map<string, number>;
  showCardSharedStatus?: boolean;
  renderShareAction?: (entry: QueueEntryView) => ReactNode;
};

function QueueCheckedOutList({
  gameId,
  entries,
  expanded,
  onToggle,
  onCheckBackIn,
  checkBackInPendingId,
  onRemovePlayer,
  removePlayerPendingId,
  allowCheckInAsPlayer = true,
  onViewPlayerInfo,
  showLeaderboardRank = false,
  leaderboardRankMap,
  showCardSharedStatus = false,
  renderShareAction,
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
                  gameId={gameId}
                  allowCheckInAsPlayer={allowCheckInAsPlayer}
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
                  onViewPlayerInfo={
                    onViewPlayerInfo ? () => onViewPlayerInfo(entry) : undefined
                  }
                  showLeaderboardRank={showLeaderboardRank}
                  leaderboardRankMap={leaderboardRankMap}
                  showCardSharedStatus={showCardSharedStatus}
                  shareAction={renderShareAction?.(entry)}
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

type GameDashboardProps = {
  mode?: GameDashboardMode;
  /** When set, validates quick-game routes (`/play` vs `/games`). */
  quickGameSurface?: "account" | "ephemeral";
};

export function GameDashboard({ mode = "operator", quickGameSurface }: GameDashboardProps) {
  const isSpectator = mode === "spectator";
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params.id ?? "";
  const isQuickGameSession = isQuickGame(gameId);
  const isEphemeralQuickSession = isEphemeralQuickGame(gameId);
  const isAccountQuickSession = isAccountQuickGame(gameId);
  const { payload: quickSession } = useQuickGameSessionAfterMount(isQuickGameSession ? gameId : "");
  const queryClient = useQueryClient();
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [pendingWinner, setPendingWinner] = useState<"A" | "B" | null>(null);
  const [endGameRematch, setEndGameRematch] = useState(false);
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");
  const [showWaitingList, setShowWaitingList] = useState(true);
  const [waitingLineView, setWaitingLineView] = useState<WaitingLineViewMode>("list");
  const [showCheckedOutList, setShowCheckedOutList] = useState(true);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showCourts, setShowCourts] = useState(true);
  const [mobileDashboardTab, setMobileDashboardTab] = useState<DashboardMobileTab>("queue");
  const [uiPrefsHydrated, setUiPrefsHydrated] = useState(false);
  const [isLgViewport, setIsLgViewport] = useState<boolean | null>(null);
  const [compactQueue, setCompactQueue] = useState(false);
  const queuePanelRef = useRef<HTMLDivElement>(null);
  const fillCourtFlowRef = useRef<FillCourtFlowHandle>(null);
  const courtsPanelRef = useRef<HTMLDivElement>(null);
  const courtsListContentRef = useRef<HTMLDivElement>(null);
  const pendingScrollToAvailableCourtsRef = useRef(false);
  const matchHistoryPanelRef = useRef<HTMLDivElement>(null);
  const [replaceDialog, setReplaceDialog] = useState<ReplacePlayerDialogState | null>(null);
  const [cancelCourtTarget, setCancelCourtTarget] = useState<number | null>(null);
  const [cancelRematchTarget, setCancelRematchTarget] = useState<number | null>(null);
  const [rematchCourtNumbers, setRematchCourtNumbers] = useState<Set<number>>(
    () => new Set(),
  );
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogLoading, setQrDialogLoading] = useState(false);
  const [databaseCheckInOpen, setDatabaseCheckInOpen] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [spectatorManualLiveRefresh, setSpectatorManualLiveRefresh] = useState(false);
  const [spectatorManualDetailsRefresh, setSpectatorManualDetailsRefresh] = useState(false);
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
      toastOperationError(error, "Could not load registration QR.");
    } finally {
      setQrDialogLoading(false);
    }
  };

  useEffect(() => {
    if (!gameId || !isQuickGameSession) return;
    const expectedPath = getQuickGameDashboardPath(gameId);
    if (isEphemeralQuickSession && quickGameSurface !== "ephemeral") {
      router.replace(expectedPath);
      return;
    }
    if (isAccountQuickSession && quickGameSurface === "ephemeral") {
      router.replace(expectedPath);
    }
  }, [
    gameId,
    isAccountQuickSession,
    isEphemeralQuickSession,
    isQuickGameSession,
    quickGameSurface,
    router,
  ]);

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

  useEffect(() => {
    const media = window.matchMedia(GAME_QUEUE_COMPACT_MEDIA);
    const apply = () => setCompactQueue(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const {
    leaseState: operatorLeaseState,
    checkAgain: checkOperatorDashboardLease,
    takeOver: takeOverOperatorDashboard,
    hasDashboardLease,
  } = useOperatorDashboardLease(gameId, !isSpectator && !isQuickGameSession);

  const operatorCanLoadData =
    !isQuickGameSession &&
    !isSpectator &&
    operatorLeaseState.status !== "blocked" &&
    operatorLeaseState.status !== "unauthorized";

  useEffect(() => {
    if (!isAccountQuickSession || !gameId || quickSession) return;

    let cancelled = false;
    void ensureAccountQuickGameHydrated(gameId)
      .then(() => {
        if (cancelled) return;
        seedLocalGameOperatorCache(queryClient, gameId);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Quick game not found.");
        router.replace("/my-games");
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, isAccountQuickSession, quickSession, queryClient, router]);

  useEffect(() => {
    if (!isEphemeralQuickSession || !gameId || quickSession) return;

    const timer = window.setTimeout(() => {
      if (!readQuickGamePayload(gameId)) {
        toast.error("Session not found. Start a new quick play session.");
        router.replace("/play");
      }
    }, 750);

    return () => window.clearTimeout(timer);
  }, [gameId, isEphemeralQuickSession, quickSession, router]);

  useEffect(() => {
    if (!isQuickGameSession || !gameId) return;
    seedLocalGameOperatorCache(queryClient, gameId);
  }, [gameId, isQuickGameSession, quickSession, queryClient]);

  const operatorShellQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    enabled: !!gameId && operatorCanLoadData,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const operatorQueueQuery = useQuery({
    queryKey: operatorQueueQueryKey(gameId),
    queryFn: () => fetchOperatorQueue(gameId),
    enabled: !!gameId && operatorCanLoadData,
    refetchOnWindowFocus: false,
  });

  const operatorWantsMatchDetails =
    !isSpectator && (showMatchHistory || mobileDashboardTab === "history");

  const operatorDetailsQuery = useQuery({
    queryKey: operatorDetailsQueryKey(gameId),
    queryFn: () => fetchOperatorDetails(gameId),
    enabled:
      !!gameId &&
      !isQuickGameSession &&
      Boolean(operatorShellQuery.data) &&
      operatorWantsMatchDetails,
    refetchOnWindowFocus: false,
  });

  useOperatorQueueRegistrationSync({
    gameId,
    enabled:
      !isQuickGameSession &&
      !!gameId &&
      hasDashboardLease &&
      operatorQueueQuery.data?.status !== "ended" &&
      operatorQueueQuery.data?.status !== "draft",
    queueQuery: operatorQueueQuery,
    detailsQuery: operatorDetailsQuery,
    refreshDetails: operatorWantsMatchDetails,
  });

  const spectatorLiveQuery = useQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live") as Promise<SpectateLivePayload>,
    enabled: !!gameId && isSpectator,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (isSpectatorGameNotFoundError(error) || isSpectatorViewUnavailableError(error)) {
        return false;
      }
      return failureCount < 8;
    },
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
      mobileDashboardTab === "history" ||
      spectatorGameStatus === "active");

  const spectatorDetailsQuery = useQuery({
    queryKey: spectatorDetailsQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "details") as Promise<SpectateDetailsPayload>,
    enabled: !!gameId && spectatorWantsDetails,
    refetchOnWindowFocus: false,
    refetchInterval: () => {
      if (spectatorGameStatus === "ended") return false;
      return SPECTATOR_LIVE_POLL_MS;
    },
  });

  const data = useMemo((): GamePayload | undefined => {
    if (isQuickGameSession) {
      return quickSession;
    }
    if (isSpectator) {
      if (!spectatorLiveQuery.data) return undefined;
      return mergeSpectatorGamePayload(
        spectatorLiveQuery.data,
        spectatorDetailsQuery.data,
      ) as GamePayload;
    }
    const shell = operatorShellQuery.data ?? operatorPlaceholderShell(gameId);
    return mergeOperatorGamePayload(
      shell,
      operatorQueueQuery.data,
      operatorDetailsQuery.data,
    );
  }, [
    gameId,
    isQuickGameSession,
    isSpectator,
    quickSession,
    operatorDetailsQuery.data,
    operatorQueueQuery.data,
    operatorShellQuery.data,
    spectatorDetailsQuery.data,
    spectatorLiveQuery.data,
  ]);

  useAccountQuickGameCheckpoint(gameId, isAccountQuickSession ? data : undefined);

  const operatorQueueLoading =
    !isSpectator &&
    !isQuickGameSession &&
    !operatorQueueQuery.data &&
    operatorQueueQuery.isPending;
  const operatorShellLoading =
    !isSpectator &&
    !isQuickGameSession &&
    !operatorShellQuery.data &&
    operatorShellQuery.isPending;
  const isLoading = isSpectator ? spectatorLiveQuery.isLoading : false;
  const error = isSpectator ? spectatorLiveQuery.error : operatorShellQuery.error ?? operatorQueueQuery.error;

  useSpectatorSessionCleanup(gameId, isSpectator);

  const handleSpectatorLiveRefresh = useCallback(() => {
    setSpectatorManualLiveRefresh(true);
    void spectatorLiveQuery.refetch().finally(() => {
      setSpectatorManualLiveRefresh(false);
    });
  }, [spectatorLiveQuery]);

  const handleSpectatorDetailsRefresh = useCallback(() => {
    setSpectatorManualDetailsRefresh(true);
    void spectatorDetailsQuery.refetch().finally(() => {
      setSpectatorManualDetailsRefresh(false);
    });
  }, [spectatorDetailsQuery]);

  const startMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isQuickGameSession) return { ok: true };

      const maxAttempts = 3;
      let lastMessage = "Failed to fill court.";

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(`/api/games/${gameId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courtNumber }),
        });
        const data = await response.json();
        if (response.ok) return data;

        lastMessage = typeof data.message === "string" ? data.message : lastMessage;
        const isCourtBusy =
          typeof lastMessage === "string" && /is not available/i.test(lastMessage);
        if (!isCourtBusy || attempt === maxAttempts - 1) {
          throw new Error(lastMessage);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      throw new Error(lastMessage);
    },
    onMutate: async (courtNumber) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyFillNextCourtOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Next court filled from the queue.");
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to fill court.");
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
      if (isQuickGameSession) {
        return {
          message: input.rematch
            ? `Court ${input.courtNumber} rematch started — same players, fresh clock.`
            : "Game ended and players returned to the queue.",
          rematch: input.rematch,
        };
      }

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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = isQuickGameSession
        ? applyEndGameWithHistoryOptimistic(previous, variables)
        : applyEndGameOptimistic(previous, variables);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);

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
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
      void announceCourtEnded(variables.courtNumber);
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      if (context?.previousRematchCourtNumbers) {
        setRematchCourtNumbers(context.previousRematchCourtNumbers);
      }
      toastOperationError(error, "Failed to end game.");
    },
  });

  const shuffleNextMutation = useMutation({
    mutationFn: async () => {
      if (isQuickGameSession) {
        const previous = readOperatorGamePayload(queryClient, gameId);
        if (!previous) throw new Error("Session not found.");
        const optimistic = applyShuffleNextOptimistic(previous);
        if (!optimistic) throw new Error("Not enough queued players.");
        writeOperatorGamePayload(queryClient, gameId, optimistic);
        return { message: "Next four players shuffled into new teams." };
      }

      const response = await fetch(`/api/games/${gameId}/shuffle-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error) => toastOperationError(error, "Failed to shuffle teams."),
  });

  const handleFillCourtConfirm = useCallback(
    (courtNumber: number) => {
      startMutation.mutate(courtNumber);
    },
    [startMutation],
  );

  const handleFillCourtShuffle = useCallback(async () => {
    await shuffleNextMutation.mutateAsync();
  }, [shuffleNextMutation]);

  const handleFillCourtReplace = useCallback(
    (sourceIndex: number, sourceEntry: QueueEntryView) => {
      setReplaceDialog({ kind: "queue", sourceIndex, sourceEntry });
    },
    [],
  );

  const swapCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isQuickGameSession) {
        const previous = readOperatorGamePayload(queryClient, gameId);
        if (!previous) throw new Error("Session not found.");
        const optimistic = applySwapCourtTeamsOptimistic(previous, courtNumber);
        if (!optimistic) throw new Error("Active court not found.");
        writeOperatorGamePayload(queryClient, gameId, optimistic);
        return { message: "Court teams shuffled." };
      }

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
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error) => toastOperationError(error, "Failed to swap court players."),
  });

  const pauseCourtMutation = useMutation({
    mutationFn: async ({ courtNumber, paused }: { courtNumber: number; paused: boolean }) => {
      if (isQuickGameSession) {
        return { message: paused ? "Court timer paused." : "Court timer resumed." };
      }

      const response = await fetch(`/api/games/${gameId}/pause-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber, paused }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async ({ courtNumber, paused }) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCourtPauseOptimistic(previous, courtNumber, paused);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to update court timer.");
    },
  });

  const pauseAllCourtsMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      if (isQuickGameSession) {
        return { message: paused ? "All courts paused." : "All courts resumed." };
      }

      const response = await fetch(`/api/games/${gameId}/pause-all-courts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async (paused) => {
      await queryClient.cancelQueries({ queryKey: ["game", gameId] });
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyAllCourtsPauseOptimistic(previous, paused);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to pause courts.");
    },
  });

  const cancelCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isQuickGameSession) {
        return { message: "Court assignment cancelled — players returned to the queue." };
      }

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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCancelCourtAssignmentOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);

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
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _courtNumber, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      if (context?.previousRematchCourtNumbers) {
        setRematchCourtNumbers(context.previousRematchCourtNumbers);
      }
      toastOperationError(error, "Failed to cancel assignment.");
    },
  });

  const cancelRematchMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isQuickGameSession) {
        return { message: "Rematch cancelled — players returned to the queue." };
      }

      const response = await fetch(`/api/games/${gameId}/cancel-rematch`, {
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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCancelRematchOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (data, courtNumber) => {
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      toast.success(data.message);
      setCancelRematchTarget(null);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error) => toastOperationError(error, "Failed to cancel rematch."),
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
    onError: (error) => toastOperationError(error, "Failed to reset game."),
  });

  const endOpenPlayMutation = useMutation({
    mutationFn: async () => {
      if (isQuickGameSession) {
        const previous = readOperatorGamePayload(queryClient, gameId);
        if (!previous) throw new Error("Session not found.");
        const ended = applyEndOpenPlayOptimistic(previous);
        writeOperatorGamePayload(queryClient, gameId, ended);
        if (isAccountQuickSession) {
          await saveQuickGameSession(gameId, ended, "end", "ended");
        }
        return { message: "Open play ended." };
      }

      const response = await fetch(`/api/games/${gameId}/end-open-play`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: async (payload) => {
      toast.success(payload.message);
      if (!isQuickGameSession) {
        await queryClient.invalidateQueries({ queryKey: ["games"] });
      } else if (isAccountQuickSession) {
        await queryClient.invalidateQueries({ queryKey: ["saved-quick-games"] });
      }
      router.replace(`/leaderboard/${gameId}`);
    },
    onError: (error) => toastOperationError(error, "Failed to end open play."),
  });

  const reorderQueueMutation = useMutation({
    mutationFn: async (orderedEntryIds: string[]) => {
      if (isQuickGameSession) return { message: "Queue order updated." };

      const response = await fetch(`/api/games/${gameId}/reorder-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedEntryIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: async (orderedEntryIds) => {
      await queryClient.cancelQueries({ queryKey: operatorQueueQueryKey(gameId) });
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyQueueReorderOptimistic(previous, orderedEntryIds);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to reorder queue.");
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async (input: ReplaceQueueMutationInput) => {
      if (isQuickGameSession) return { message: "Queue player replaced." };

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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyQueueSwapOptimistic(previous, variables);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to replace player.");
    },
  });

  const replaceCourtMutation = useMutation({
    mutationFn: async (input: ReplaceCourtMutationInput) => {
      if (isQuickGameSession) return { message: "Court player replaced." };

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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCourtReplaceOptimistic(previous, variables);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to replace player.");
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
      if (isQuickGameSession) return { message: "Player checked out." };

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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyCheckoutOptimistic(previous, variables.queueEntryId);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (payload, variables) => {
      if (gameId) {
        removeActiveQueueHighlightPlayerId(gameId, variables.checkedOutPlayerId);
      }
      toast.success(payload.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
      if (!isSpectator && !isQuickGameSession && gameId && variables.playerName) {
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
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to remove player from queue.");
    },
  });

  const removePlayerFromGameMutation = useMutation({
    mutationFn: async (input: { playerId: string }) => {
      if (isQuickGameSession) return { message: "Player removed from session." };

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
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };

      const optimistic = applyRemovePlayerOptimistic(previous, variables.playerId);
      if (!optimistic) return { previous };

      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (payload, variables) => {
      if (gameId) {
        removeActiveQueueHighlightPlayerId(gameId, variables.playerId);
      }
      toast.success(payload.message);
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to remove player.");
    },
  });

  const checkBackInMutation = useMutation({
    mutationFn: async (queueEntryId: string) => {
      if (isQuickGameSession) {
        const previous = readOperatorGamePayload(queryClient, gameId);
        if (!previous) throw new Error("Session not found.");
        const optimistic = applyCheckBackInOptimistic(previous, queueEntryId);
        if (!optimistic) throw new Error("Player not found on checkout list.");
        writeOperatorGamePayload(queryClient, gameId, optimistic);
        return { message: "Player checked back in." };
      }

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
      if (!isQuickGameSession) {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }
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
        ? selfQueueCheckoutMessageHtml(playerName)
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
      Swal.close();
      if (shouldSuppressUserNotification(error)) return;
      Swal.fire({
        ...alertBaseOptions,
        icon: "error",
        title: "Check-in failed",
        text: getPublicErrorMessage(error, "Failed to check player back in."),
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
  const spectatorLeaderboardRankMap = useMemo(
    () => buildPlayerLeaderboardRankMap(data?.leaderboard),
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
    if (!uiPrefsHydrated || isLgViewport === null || !gameId || !data?.queue?.length) {
      return;
    }
    if (isSpectator && isLoading) return;
    if (!isSpectator && operatorQueueLoading) return;
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
    operatorQueueLoading,
    gameId,
    data?.queue,
    showWaitingList,
    waitingLineView,
    mobileDashboardTab,
  ]);

  const emptyCourtsForScroll = useMemo(
    () =>
      [...(data?.courts ?? [])]
        .filter((c) => c.status === "empty")
        .sort((a, b) => a.courtNumber - b.courtNumber),
    [data?.courts],
  );

  const scrollToAvailableCourtsView = useCallback(() => {
    const firstEmptyCourtNumber = emptyCourtsForScroll[0]?.courtNumber;
    const target =
      (firstEmptyCourtNumber != null
        ? document.getElementById(`court-card-${firstEmptyCourtNumber}`)
        : null) ?? courtsListContentRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [emptyCourtsForScroll]);

  const handleAvailableCourtsClick = useCallback(() => {
    const needsMobileExpand = !isSpectator && !showCourts && isLgViewport === false;
    if (needsMobileExpand) {
      setShowCourts(true);
      saveShowCourts(true);
      pendingScrollToAvailableCourtsRef.current = true;
      return;
    }
    scrollToAvailableCourtsView();
  }, [isLgViewport, isSpectator, scrollToAvailableCourtsView, showCourts]);

  useEffect(() => {
    if (!showCourts || !pendingScrollToAvailableCourtsRef.current) return;
    pendingScrollToAvailableCourtsRef.current = false;
    scrollToAvailableCourtsView();
  }, [scrollToAvailableCourtsView, showCourts]);

  const readOnly = isSpectator;
  const loadingLabel = "Loading game dashboard...";
  const operatorLeasePending = !isSpectator && operatorLeaseState.status === "loading";

  if (isSpectator && !spectatorLiveQuery.data) {
    if (spectatorLiveQuery.isError && !spectatorLiveQuery.isFetching) {
      if (isSpectatorGameNotFoundError(spectatorLiveQuery.error)) {
        return (
          <main className="game-dashboard--spectator flex min-h-screen items-center justify-center p-8">
            <p className="text-center text-base text-muted-foreground">This game could not be found.</p>
          </main>
        );
      }

      if (isSpectatorViewUnavailableError(spectatorLiveQuery.error)) {
        return (
          <SpectatorUnavailableScreen
            onRetry={() => void spectatorLiveQuery.refetch()}
          />
        );
      }
    }

    return <SpectatorLoadingScreen />;
  }

  if (!isSpectator && !isQuickGameSession && operatorLeaseState.status === "unauthorized") {
    return (
      <main className="game-dashboard--operator flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </main>
    );
  }

  if (!isSpectator && !isQuickGameSession && operatorLeaseState.status === "blocked") {
    return (
      <OperatorDashboardLeaseGate
        gameId={gameId}
        gameTitle={operatorShellQuery.data?.game.title}
        deviceHint={operatorLeaseState.deviceHint}
        lastSeenAt={operatorLeaseState.lastSeenAt}
        takenOver={operatorLeaseState.takenOver}
        onCheckAgain={() => void checkOperatorDashboardLease()}
        onTakeOver={() => void takeOverOperatorDashboard()}
      />
    );
  }

  if (isSpectator && isLoading) {
    return <div className="p-8 text-base text-muted-foreground">{loadingLabel}</div>;
  }
  if (isSpectator && error) {
    if (isSpectatorViewUnavailableError(error) || shouldSuppressUserNotification(error)) {
      return (
        <SpectatorUnavailableScreen onRetry={() => void spectatorLiveQuery.refetch()} />
      );
    }

    return (
      <div className="p-8 text-destructive">
        Failed to load game data:{" "}
        {getPublicErrorMessage(error, "Unable to load game data. Please try again.")}
      </div>
    );
  }
  if (!data) {
    if (isQuickGameSession && !isSpectator) {
      return (
        <main className="game-dashboard--operator flex min-h-screen items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Loading session…</p>
        </main>
      );
    }

    return <div className="p-8">No game data.</div>;
  }

  const { game, courts, matches, recap } = data;

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
    return `${matches.length} ${matches.length === 1 ? "match" : "matches"} recorded`;
  })();

  const spectatorMatchHistoryEmptyMessage = "No matches recorded for this session yet.";

  const quickGameHomeHref = isEphemeralQuickSession ? "/play" : "/";
  const leaderboardHref = `/leaderboard/${game.gameId}`;

  const isCourtRematch = (court: CourtView) =>
    court.isRematch === true || rematchCourtNumbers.has(court.courtNumber);

  const openPlayDateLabel = formatOpenPlayDate(game.openPlayDate);
  const openPlayTimeLabel = game.openPlayTimeRange?.trim() || null;
  const openPlayScheduleLabel = formatOpenPlayScheduleLabel(
    game.openPlayDate,
    game.openPlayTimeRange,
  );
  const isPastGame = game.status === "ended";
  const birthdayThisMonthCount = isSpectator
    ? (spectatorLiveQuery.data?.birthdayThisMonthCount ?? 0)
    : (operatorQueueQuery.data?.birthdayThisMonthCount ?? 0);
  const firstTimerCount = isSpectator
    ? (spectatorLiveQuery.data?.firstTimerCount ?? 0)
    : (operatorQueueQuery.data?.firstTimerCount ?? 0);
  const showSpectatorEndedRecap = isSpectator && isPastGame;
  const canResetGame = isDemoOpenPlayTitle(game.title);
  const hideControls =
    readOnly ||
    isPastGame ||
    (!isQuickGameSession && operatorLeasePending) ||
    (!isQuickGameSession && !hasDashboardLease) ||
    operatorQueueLoading;
  const canReorderQueue = !hideControls && queueWithStats.length >= 2;
  const queueEntryIds = queueWithStats.map((entry) => entry._id);
  const canCheckoutFromQueue = !isPastGame;
  const showOperatorMobileNav = !showSpectatorEndedRecap && !isSpectator;
  const showQrRegistration =
    !isQuickGameSession && !readOnly && !isPastGame && game.allowQrRegistration !== false;
  const showManualAddPlayer =
    !readOnly &&
    !isPastGame &&
    game.registrationMode === "owner" &&
    game.allowManualPlayerAdd === true;
  const resolvedQrDialogData =
    qrDialogData ??
    (game.registerUrl && game.publicQrCodeDataUrl
      ? { registerUrl: game.registerUrl, publicQrCodeDataUrl: game.publicQrCodeDataUrl }
      : null);

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

  const renderSpectatorShareAction = (entry: QueueEntryView, compact?: boolean) => {
    if (!isSpectator || isPastGame || selfPlayerIds.length === 0) return undefined;

    const playerId = queueEntryPlayerId(entry);
    if (!playerId || !selfPlayerIds.includes(playerId)) return undefined;

    return (
      <SpectatorPlayerCardShareButton
        gameId={gameId}
        entry={entry}
        playerId={playerId}
        selfPlayerIds={selfPlayerIds}
        gameTitle={game.title}
        clubName={spectatorLiveQuery.data?.clubBranding?.clubName ?? null}
        clubLogoUrl={spectatorLiveQuery.data?.clubBranding?.clubLogoUrl ?? null}
        clubTagline={spectatorLiveQuery.data?.clubBranding?.clubTagline ?? null}
        openPlaySchedule={openPlayScheduleLabel}
        leaderboardRankMap={spectatorLeaderboardRankMap}
        compact={compact}
      />
    );
  };

  const renderQueueEntryRow = (
    entry: QueueEntryView,
    index: number,
    drag?: QueueDragHandleProps,
    options?: { compactName?: boolean; hideSessionStats?: boolean },
  ) => {
    const isNextUp = index < 4;
    return (
      <QueueEntryRow
        entry={entry}
        index={index}
        gameId={!hideControls ? gameId : undefined}
        allowCheckInAsPlayer={!isQuickGameSession}
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
        hideSessionStats={options?.hideSessionStats}
        dragHandle={
          drag ? (
            <QueueDragHandle
              {...drag}
              label={`Reorder ${formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName)} in queue`}
            />
          ) : undefined
        }
        showLeaderboardRank={isSpectator}
        leaderboardRankMap={spectatorLeaderboardRankMap}
        shareAction={renderSpectatorShareAction(entry, options?.compactName)}
        showCardSharedStatus={!isSpectator && !hideControls}
      />
    );
  };

  const renderQueuedEntry = (
    entry: QueueEntryView,
    index: number,
    options?: { sortable?: boolean; compactName?: boolean; hideSessionStats?: boolean },
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
  const canRemoveEntry = (entry: QueueEntryView) => {
    const spectatorSelfCheckout =
      isSpectator && canCheckoutFromQueue && canSelfCheckoutEntry(entry);
    if (spectatorSelfCheckout && isLgViewport === false) {
      return false;
    }
    return !hideControls || spectatorSelfCheckout;
  };
  const emptyCourts = [...courts]
    .filter((c) => c.status === "empty")
    .sort((a, b) => a.courtNumber - b.courtNumber);
  const clearingCourtNumbers = new Set<number>();
  if (
    endMutation.isPending &&
    endMutation.variables != null &&
    !endMutation.variables.rematch
  ) {
    clearingCourtNumbers.add(endMutation.variables.courtNumber);
  }
  if (cancelCourtMutation.isPending && cancelCourtMutation.variables != null) {
    clearingCourtNumbers.add(cancelCourtMutation.variables);
  }
  const fillableEmptyCourts = emptyCourts.filter(
    (court) => !clearingCourtNumbers.has(court.courtNumber),
  );
  const nextEmptyCourt = fillableEmptyCourts[0] ?? null;
  const emptyCourtNumbers = fillableEmptyCourts.map((court) => court.courtNumber);
  const courtsClearingInProgress = clearingCourtNumbers.size > 0;
  const canFillNextCourt = queueWithStats.length >= 4 && nextEmptyCourt != null;
  const fillCourtTeamA = queueWithStats.slice(0, 2);
  const fillCourtTeamB = queueWithStats.slice(2, 4);
  const fillingCourtNumber =
    startMutation.isPending && startMutation.variables != null ? startMutation.variables : null;
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

  const handleTeamAScoreChange = (value: number) => {
    setTeamAScore(String(value));
    if (pendingWinner === "A") {
      const maxLoser = Math.max(0, value - 1);
      const loserScore = parseEndGameScoreField(teamBScore);
      if (loserScore > maxLoser) {
        setTeamBScore(String(maxLoser));
      }
    }
  };

  const handleTeamBScoreChange = (value: number) => {
    setTeamBScore(String(value));
    if (pendingWinner === "B") {
      const maxLoser = Math.max(0, value - 1);
      const loserScore = parseEndGameScoreField(teamAScore);
      if (loserScore > maxLoser) {
        setTeamAScore(String(maxLoser));
      }
    }
  };

  const activeCourtCount = courts.filter((court) => court.status === "active").length;
  const activeCourts = courts.filter((court) => court.status === "active");
  const allActiveCourtsPaused =
    activeCourts.length > 0 && activeCourts.every((court) => Boolean(court.pausedAt));
  const availableCourtCount = courts.length - activeCourtCount;
  const shouldBlinkCourtsMobileTab =
    availableCourtCount > 0 && mobileDashboardTab !== "courts";

  const renderQueuePanel = () => {
    const spectatorQueueRefreshStatus =
      isSpectator && !isPastGame
        ? getSpectatorPanelRefreshStatus(
            spectatorLiveQuery.isFetching,
            spectatorLiveQuery.isLoading,
            spectatorManualLiveRefresh,
          )
        : null;

    return (
    <Card ref={queuePanelRef} className="glass-panel dashboard-panel dashboard-panel--queue">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle>Queue</CardTitle>
            {isSpectator && !isPastGame ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="queue-refresh-btn h-8 w-8 shrink-0 px-0"
                onClick={handleSpectatorLiveRefresh}
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
          {spectatorQueueRefreshStatus ? (
            <p className="caption mt-0.5 text-primary" aria-live="polite">
              {spectatorQueueRefreshStatus}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!hideControls ? (
            <Button
              onClick={() => fillCourtFlowRef.current?.openFillNextCourt()}
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
          <DashboardPanelFullscreenButton containerRef={queuePanelRef} panelName="queue" />
        </div>
      </CardHeader>
      <CardContent className="queue-list dashboard-panel-content">
        {operatorQueueLoading ? (
          <DashboardPanelLoading label="Loading queue…" />
        ) : operatorQueueQuery.isError && !operatorQueueQuery.data ? (
          shouldSuppressUserNotification(operatorQueueQuery.error) ? (
            <DashboardPanelLoading label="Loading queue…" />
          ) : (
          <p className="text-destructive">
            Failed to load queue:{" "}
            {getPublicErrorMessage(operatorQueueQuery.error, "Unable to load queue.")}
          </p>
          )
        ) : queueWithStats.length === 0 && checkedOutWithStats.length === 0 ? (
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
                    <Badge className="badge-next-up-count shrink-0">
                      {Math.min(4, queueWithStats.length)} / 4
                    </Badge>
                  </div>
                  <div className="queue-next-up-slots">
                    {queueWithStats.slice(0, 4).map((entry, index) =>
                      renderQueuedEntry(entry, index, { compactName: compactQueue }),
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
                            renderQueuedEntry(entry, offset + 4, {
                              compactName: compactQueue,
                            }),
                          )}
                        </div>
                      ) : (
                        <WaitingLineGroupView
                          waitingEntries={waitingLineEntries}
                          compact={compactQueue}
                          renderEntry={(entry, queueIndex) =>
                            renderQueuedEntry(entry, queueIndex, {
                              sortable: false,
                              compactName: true,
                              hideSessionStats: compactQueue,
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
                gameId={gameId}
                entries={checkedOutWithStats}
                allowCheckInAsPlayer={!isQuickGameSession}
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
                showCardSharedStatus={!isSpectator}
                renderShareAction={
                  isSpectator ? (entry) => renderSpectatorShareAction(entry) : undefined
                }
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
    );
  };

  const renderCourtsPanel = (inSpectatorMobileTab = false) => {
    const spectatorCourtsRefreshStatus =
      isSpectator &&
      !isPastGame &&
      inSpectatorMobileTab
        ? getSpectatorPanelRefreshStatus(
            spectatorLiveQuery.isFetching,
            spectatorLiveQuery.isLoading,
            spectatorManualLiveRefresh,
          )
        : null;

    return (
    <Card
      ref={courtsPanelRef}
      className="glass-panel courts-panel dashboard-panel dashboard-panel--courts"
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Courts</CardTitle>
          <CourtsSummary courts={courts} onAvailableClick={handleAvailableCourtsClick} />
          {spectatorCourtsRefreshStatus ? (
            <p className="caption mt-0.5 text-primary" aria-live="polite">
              {spectatorCourtsRefreshStatus}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
        {isSpectator && !isPastGame && inSpectatorMobileTab ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="courts-refresh-btn h-8 w-8 shrink-0 px-0"
            onClick={handleSpectatorLiveRefresh}
            disabled={spectatorLiveQuery.isFetching}
            aria-label="Refresh courts"
          >
            <RefreshCw
              className={cn("h-4 w-4", spectatorLiveQuery.isFetching && "animate-spin")}
            />
          </Button>
        ) : null}
        {!hideControls && activeCourts.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="courts-pause-all-btn shrink-0"
            disabled={pauseAllCourtsMutation.isPending}
            onClick={() => pauseAllCourtsMutation.mutate(!allActiveCourtsPaused)}
            aria-label={allActiveCourtsPaused ? "Unpause all courts" : "Pause all courts"}
          >
            {pauseAllCourtsMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                {allActiveCourtsPaused ? "Resuming…" : "Pausing…"}
              </>
            ) : allActiveCourtsPaused ? (
              <>
                <Play className="mr-1.5 h-4 w-4" aria-hidden />
                Unpause all
              </>
            ) : (
              <>
                <Pause className="mr-1.5 h-4 w-4" aria-hidden />
                Pause all
              </>
            )}
          </Button>
        ) : null}
          <DashboardPanelFullscreenButton containerRef={courtsPanelRef} panelName="courts" />
        </div>
      </CardHeader>
      <CardContent
        ref={courtsListContentRef}
        id={inSpectatorMobileTab ? "courts-list-mobile" : "courts-list"}
        className={cn(
          "court-grid court-grid--list dashboard-panel-content grid grid-cols-1 gap-3",
          !inSpectatorMobileTab && !showCourts && "hidden lg:grid",
        )}
      >
        {operatorQueueLoading ? (
          <DashboardPanelLoading label="Loading courts…" />
        ) : operatorQueueQuery.isError && !operatorQueueQuery.data ? (
          shouldSuppressUserNotification(operatorQueueQuery.error) ? (
            <DashboardPanelLoading label="Loading courts…" />
          ) : (
          <p className="text-destructive">
            Failed to load courts:{" "}
            {getPublicErrorMessage(operatorQueueQuery.error, "Unable to load courts.")}
          </p>
          )
        ) : courts.length === 0 ? (
          <p className="text-muted-foreground">No courts configured.</p>
        ) : (
          courts.map((court) => (
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
              hideControls
                ? undefined
                : async () => {
                    await swapCourtMutation.mutateAsync(court.courtNumber);
                  }
            }
            swapPending={
              swapCourtMutation.isPending && swapCourtMutation.variables === court.courtNumber
            }
            onTogglePause={
              hideControls || court.status !== "active"
                ? undefined
                : () =>
                    pauseCourtMutation.mutate({
                      courtNumber: court.courtNumber,
                      paused: !court.pausedAt,
                    })
            }
            pausePending={
              pauseAllCourtsMutation.isPending ||
              (pauseCourtMutation.isPending &&
                pauseCourtMutation.variables?.courtNumber === court.courtNumber)
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
            isClearing={clearingCourtNumbers.has(court.courtNumber)}
            onFillCourt={
              hideControls || court.status !== "empty"
                ? undefined
                : () => fillCourtFlowRef.current?.openFillCourt(court.courtNumber)
            }
            canFillCourt={
              !hideControls &&
              court.status === "empty" &&
              !clearingCourtNumbers.has(court.courtNumber) &&
              queueWithStats.length >= 4
            }
            fillCourtPending={
              startMutation.isPending && startMutation.variables === court.courtNumber
            }
          />
        ))
        )}
      </CardContent>
    </Card>
    );
  };

  const renderMatchHistoryPanel = (inSpectatorMobileTab = false) => {
    const historyMatches = matches;
    const panelVisible = inSpectatorMobileTab || showMatchHistory;
    const detailsQuery = isSpectator ? spectatorDetailsQuery : operatorDetailsQuery;
    const spectatorHistoryRefreshStatus =
      isSpectator && panelVisible
        ? getSpectatorPanelRefreshStatus(
            detailsQuery.isFetching,
            detailsQuery.isLoading,
            spectatorManualDetailsRefresh,
          )
        : null;

    return (
      <Card
        ref={matchHistoryPanelRef}
        className="glass-panel match-history-panel dashboard-panel dashboard-panel--history"
      >
        <CardHeader className="flex flex-col gap-3">
          <div className="match-history-panel-header flex w-full flex-nowrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>Match History</CardTitle>
              <p className="caption">{spectatorMatchHistoryCaption}</p>
              {spectatorHistoryRefreshStatus ? (
                <p className="caption mt-0.5 text-primary" aria-live="polite">
                  {spectatorHistoryRefreshStatus}
                </p>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
              {panelVisible ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="match-history-refresh"
                  onClick={() => {
                    if (isSpectator) {
                      handleSpectatorDetailsRefresh();
                    } else {
                      void detailsQuery.refetch();
                    }
                  }}
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
              <DashboardPanelFullscreenButton
                containerRef={matchHistoryPanelRef}
                panelName="match history"
              />
            </div>
          </div>
        </CardHeader>
        {panelVisible ? (
          <CardContent
            id={inSpectatorMobileTab ? "match-history-list-mobile" : "match-history-list"}
            className="dashboard-panel-content"
          >
            {detailsQuery.isLoading && !detailsQuery.data ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading match history…
              </div>
            ) : (
              <MatchHistoryList
                key={isSpectator ? "spectator" : "operator"}
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
                {!isPastGame ? (
                  <SwitchToCourtViewButton
                    gameId={gameId}
                    variant={isSpectator ? "spectator" : "operator"}
                    showLabel
                    buttonClassName="game-dashboard-court-view-btn h-8 gap-1 px-2 text-xs font-semibold shadow-sm sm:gap-1.5 sm:px-2.5 lg:h-11 lg:gap-2 lg:px-5 lg:text-base"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="game-dashboard-header-top">
              <div className="game-dashboard-header-main min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="page-title">
                    {operatorShellLoading ? "Loading session…" : game.title}
                  </h1>
                  {!operatorShellLoading && isAccountQuickSession ? <LiveQueueOffBadge /> : null}
                </div>
                {isEphemeralQuickSession ? (
                  <p className="caption mt-1 text-muted-foreground">
                    Public quick play — this session lives only in this browser. Nothing is saved to
                    our servers.
                  </p>
                ) : isAccountQuickSession ? (
                  <p className="caption mt-1 text-muted-foreground">
                    Quick game — plays in this browser and syncs to your account when you end open
                    play.
                  </p>
                ) : null}
                {operatorLeasePending ? (
                  <p className="caption mt-1 flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Securing operator dashboard…
                  </p>
                ) : null}
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
                <SpectateFirstTimersBadge gameId={gameId} count={firstTimerCount} />
                <SpectateBirthdaysThisMonthBadge
                  gameId={gameId}
                  count={birthdayThisMonthCount}
                />
                {game.status === "ended" ? (
                  <Badge variant="destructive" className="game-dashboard-meta-badge w-fit">
                    Status: ended
                  </Badge>
                ) : null}
              </div>
            </div>
            {!showSpectatorEndedRecap && !isSpectator ? (
            <div className="game-toolbar mt-4 hidden flex-wrap items-center gap-2 lg:flex">
              {isQuickGameSession ? (
                <Link href={quickGameHomeHref}>
                  <Button size="lg" variant="outline">
                    <House className="mr-2 h-4 w-4" /> Home
                  </Button>
                </Link>
              ) : (
                <Link href="/">
                  <Button size="lg" variant="outline">
                    <House className="mr-2 h-4 w-4" /> Home
                  </Button>
                </Link>
              )}
              <Link
                href={leaderboardHref}
                onMouseEnter={() => prefetchLeaderboardRecap(queryClient, gameId, false)}
                onFocus={() => prefetchLeaderboardRecap(queryClient, gameId, false)}
              >
                <Button size="lg" variant="outline">
                  <Trophy className="mr-2 h-4 w-4" /> Leaderboard
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
              <GameSessionActionsMenu
                showDatabaseCheckIn={!readOnly && !isPastGame && !isQuickGameSession}
                onDatabaseCheckIn={() => setDatabaseCheckInOpen(true)}
                showAddPlayer={showManualAddPlayer}
                onAddPlayer={() => setAddPlayerOpen(true)}
                showEndOpenPlay={!readOnly && !isPastGame}
                endOpenPlayPending={endOpenPlayMutation.isPending}
                onEndOpenPlay={handleEndOpenPlay}
              />
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
              {!isQuickGameSession ? (
                <GameCheckoutNotificationBell gameId={gameId} iconOnly />
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
            <section className="game-dashboard-split grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr] xl:grid-cols-2">
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
                  { id: "courts" as const, label: "Courts" },
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
                const courtsTabAlert = tab.id === "courts" && shouldBlinkCourtsMobileTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`dashboard-tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`dashboard-panel-${tab.id}`}
                    aria-label={
                      courtsTabAlert
                        ? `Courts. ${availableCourtCount} courts available.`
                        : undefined
                    }
                    onClick={() => setMobileDashboardTab(tab.id)}
                    className={cn(
                      "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm",
                      selected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                      courtsTabAlert && "dashboard-mobile-tab--courts-alert font-semibold",
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.id === "courts" ? (
                      courts.length > 0 ? (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] sm:text-xs">
                          {activeCourtCount}/{courts.length}
                        </Badge>
                      ) : null
                    ) : tab.count != null && tab.count > 0 ? (
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
          {!hideControls ? (
            <FillCourtFlow
              ref={fillCourtFlowRef}
              hideTrigger
              canFillNextCourt={canFillNextCourt}
              courtsClearingInProgress={courtsClearingInProgress}
              queuePlayerCount={queueWithStats.length}
              teamA={fillCourtTeamA}
              teamB={fillCourtTeamB}
              waitingLineEntries={waitingLineEntries}
              emptyCourtNumbers={emptyCourtNumbers}
              fillPending={startMutation.isPending}
              replacePendingSourceIndex={
                replaceMutation.isPending ? (replaceMutation.variables?.sourceIndex ?? null) : null
              }
              onConfirmFill={handleFillCourtConfirm}
              onShuffle={handleFillCourtShuffle}
              onReplace={handleFillCourtReplace}
            />
          ) : null}
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

      {!readOnly && !isPastGame && !isQuickGameSession ? (
        <DatabaseCheckInDialog
          gameId={gameId}
          open={databaseCheckInOpen}
          onOpenChange={setDatabaseCheckInOpen}
        />
      ) : null}

      {showManualAddPlayer ? (
        <AddManualPlayerDialog
          gameId={gameId}
          localMode={isQuickGameSession}
          sessionOpenPlayType={game.openPlayType}
          open={addPlayerOpen}
          onOpenChange={setAddPlayerOpen}
          onPlayerAdded={() => {
            setShowWaitingList(true);
            saveShowWaitingList(true);
            if (!isLgViewport) {
              setMobileDashboardTab("queue");
            }
          }}
        />
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
                    <NumberStepper
                      id="team-a-score"
                      min={0}
                      max={
                        pendingWinner === "A"
                          ? MAX_MATCH_SCORE
                          : endGameLoserScoreMax ?? MAX_MATCH_SCORE
                      }
                      value={parseEndGameScoreField(teamAScore)}
                      onChange={handleTeamAScoreChange}
                      className="court-winner-score-stepper w-full gap-1"
                      buttonClassName="h-9 w-9"
                      inputClassName="h-9 min-w-0 flex-1 px-1"
                      invalid={endGameScoreError != null && pendingWinner === "B"}
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
                    <NumberStepper
                      id="team-b-score"
                      min={0}
                      max={
                        pendingWinner === "B"
                          ? MAX_MATCH_SCORE
                          : endGameLoserScoreMax ?? MAX_MATCH_SCORE
                      }
                      value={parseEndGameScoreField(teamBScore)}
                      onChange={handleTeamBScoreChange}
                      className="court-winner-score-stepper w-full gap-1"
                      buttonClassName="h-9 w-9"
                      inputClassName="h-9 min-w-0 flex-1 px-1"
                      invalid={endGameScoreError != null && pendingWinner === "A"}
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
          gameId={gameId}
          isQuickGameSession={isQuickGameSession}
          homeHref={quickGameHomeHref}
          homeLabel="Home"
          showQr={showQrRegistration}
          qrLoading={qrDialogLoading}
          onQrClick={openQrRegistrationDialog}
          showDatabaseCheckIn={!readOnly && !isPastGame && !isQuickGameSession}
          onDatabaseCheckInClick={() => setDatabaseCheckInOpen(true)}
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
