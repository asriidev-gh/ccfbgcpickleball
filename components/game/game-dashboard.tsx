"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  QrCode,
  Play,
  Pause,
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
  applyQueueSwapByIndexOptimistic,
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
import { useAuthMe } from "@/hooks/use-auth-me";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import {
  ensureAccountQuickGameHydrated,
  saveQuickGameSession,
} from "@/lib/quick-game-persistence-client";
import { readQuickGamePayload } from "@/lib/quick-game-store";
import { addLocalCourt } from "@/lib/local-game-session";
import { MAX_QUICK_PLAY_COURTS, isMixedDoublesMatching } from "@/lib/quick-play-wizard-shared";
import {
  DOUBLES_PLAYERS_PER_COURT,
  formatDoublesNextOnCourtSubtitle,
  isDoublesWinnerLoserRotation,
  pickDoublesCourtFoursome,
  resolveDoublesRotationQueue,
  segmentDoublesQueueDisplay,
} from "@/lib/doubles/doubles-queue-fill";
import {
  beginEphemeralQuickGameSaveToAccount,
  promptSaveEphemeralQuickGame,
} from "@/lib/ephemeral-quick-game-transfer";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import { CourtEndGameDialog } from "@/components/game/court-end-game-dialog";
import { DashboardPanelFullscreenButton } from "@/components/game/dashboard-panel-fullscreen-button";
import { GamePlayerProfileProvider } from "@/components/game/game-player-profile-context";
import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import type { LeaderboardRow } from "@/components/game/leaderboard-standings";
import { PlayerSessionMatchHistoryDialog } from "@/components/game/player-session-match-history-dialog";
import { GameDashboardMobileNav } from "@/components/game/game-dashboard-mobile-nav";
import { OpenPlaySkillLevelPills } from "@/components/game/open-play-skill-level-pills";
import { GameFormatHeaderBadges } from "@/components/game/game-format-header-badges";
import { SpectateBirthdaysThisMonthBadge } from "@/components/player/spectate-birthdays-this-month";
import { SpectateFirstTimersBadge } from "@/components/player/spectate-first-timers";
import { SpectatorPlayerCardShareButton } from "@/components/game/spectator-player-card-share-button";
import { SpectatorPlayerCardShareDialog } from "@/components/game/spectator-player-card-share-dialog";
import { SpectatorPlayerEndorseButton } from "@/components/game/spectator-player-endorse-button";
import { SpectatePlayerEndorseDialog } from "@/components/player/spectate-player-endorse-dialog";
import { SpectatePlayerEndorsementsListDialog } from "@/components/player/spectate-player-endorsements-list-dialog";
import { DatabaseCheckInDialog } from "@/components/game/database-check-in-dialog";
import { databaseCheckInPlayersQueryKey } from "@/lib/operator-database-check-in-shared";
import { AddCourtButton } from "@/components/game/add-court-button";
import { AddManualPlayerDialog } from "@/components/game/add-manual-player-dialog";
import { GameSessionActionsMenu } from "@/components/game/game-session-actions-menu";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { promptIfRegistrationFullFromSession } from "@/components/game/registration-capacity-prompt";
import { fetchGameRegistrationQr } from "@/lib/fetch-game-registration-qr";
import {
  MatchHistoryList,
  type MatchHistoryView,
} from "@/components/game/match-history-list";
import { formatOpenPlayDate, formatOpenPlayScheduleLabel, formatVenueShareLabel } from "@/lib/open-play-time-range";
import { FillCourtFlow, type FillCourtFlowHandle } from "@/components/game/fill-court-flow";
import { NextCourtMatchAnalysis } from "@/components/game/next-court-match-analysis";
import {
  buildQueueNextCourtWaitingSwapOrder,
  isDoublesMatchupAnalysisMatchingType,
} from "@/lib/next-court-match-analysis";
import { SwitchToCourtViewButton } from "@/components/game/switch-to-court-view-button";
import { LiveQueueOffBadge } from "@/components/home/live-queue-off-badge";
import {
  ReplacePlayerDialog,
  type ReplacePlayerConfirmInput,
  type ReplacePlayerDialogState,
} from "@/components/game/replace-player-dialog";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import {
  QueueNextUpSlots,
  NextOnCourtLayoutToggle,
  loadNextOnCourtLayoutMode,
  saveNextOnCourtLayoutMode,
  type NextOnCourtLayoutMode,
} from "@/components/game/queue-next-up-slots";
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
  buildSessionLeaderboardRankMap,
  buildPlayerSessionStatsMap,
  isSessionUndefeated,
  type LeaderboardGamesPlayedRow,
} from "@/lib/games-played-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
} from "@/lib/match-score-validation";
import { buildSessionPlayerLookup } from "@/lib/session-player-lookup";
import { announceCourtEnded } from "@/lib/call-names-speech";
import { cn, formatPlayerDisplayName } from "@/lib/utils";
import { useOperatorDashboardLease } from "@/hooks/use-operator-dashboard-lease";
import { useOperatorQueueRegistrationSync } from "@/hooks/use-operator-queue-registration-sync";
import { OperatorDashboardLeaseGate } from "@/components/game/operator-dashboard-lease-gate";
import { useSpectatorSessionCleanup } from "@/hooks/use-spectator-session-cleanup";
import { GameCheckoutNotificationBell } from "@/components/game/spectator-notification-bell";
import {
  fetchSpectatePlayerEndorsements,
  fetchSpectateGameEndorsementCounts,
  spectatePlayerEndorsementsQueryKey,
  spectateGameEndorsementCountsQueryKey,
} from "@/lib/fetch-spectate-player-endorsement";
import { dispatchSpectatorCheckoutNotification } from "@/lib/spectator-checkout-notifications";
import {
  mergeSpectatorGamePayload,
  type SpectateLivePayload,
} from "@/lib/spectate-payload";
import {
  fetchOperatorMatchHistory,
  fetchOperatorQueue,
  fetchOperatorShell,
  operatorMatchHistoryQueryKey,
  operatorQueueQueryKey,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import {
  mergeOperatorGamePayload,
  type OperatorFullPayload,
  type OperatorQueuePayload,
  type OperatorShellPayload,
} from "@/lib/operator-payload";
import { prefetchLeaderboardRecap } from "@/lib/fetch-leaderboard";
import { buildSpectatorLeaderboardHref } from "@/lib/leaderboard-navigation";
import { leaderboardRowToShareEntry } from "@/lib/leaderboard-share";
import {
  fetchSpectateGame,
  isSpectatorViewUnavailableError,
  spectatorLiveQueryKey,
  spectatorMatchHistoryQueryKey,
  spectatorRecapQueryKey,
} from "@/lib/fetch-spectate-game";
import { SPECTATOR_LIVE_POLL_MS } from "@/lib/spectator-polling";
import {
  operatorMatchHistoryQueryOptions,
  OPERATOR_QUEUE_STALE_TIME_MS,
  operatorQueueQueryOptions,
  operatorShellQueryOptions,
} from "@/lib/operator-query-options";
import {
  spectatorEndorsementQueryOptions,
  spectatorLiveQueryOptions,
  spectatorMatchHistoryQueryOptions,
  spectatorRecapQueryOptions,
} from "@/lib/spectator-query-options";
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
  showEndorsementStatus?: boolean;
  showEndorsementInPlayerLabel?: boolean;
  getEndorsementCount?: (entry: QueueEntryView) => number;
  onEndorsementClick?: (entry: QueueEntryView) => void;
  onSharedClick?: (entry: QueueEntryView) => void;
  onUndefeatedClick?: (entry: QueueEntryView) => void;
  renderShareAction?: (entry: QueueEntryView) => ReactNode;
  renderEndorseAction?: (entry: QueueEntryView) => ReactNode;
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
  showEndorsementStatus = false,
  showEndorsementInPlayerLabel = false,
  getEndorsementCount,
  onEndorsementClick,
  onSharedClick,
  onUndefeatedClick,
  renderShareAction,
  renderEndorseAction,
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
                  onSharedClick={
                    onSharedClick && entry.cardSharedAt ? () => onSharedClick(entry) : undefined
                  }
                  onUndefeatedClick={
                    onUndefeatedClick ? () => onUndefeatedClick(entry) : undefined
                  }
                  showEndorsementStatus={showEndorsementStatus}
                  showEndorsementInPlayerLabel={showEndorsementInPlayerLabel}
                  endorsementCount={getEndorsementCount?.(entry) ?? 0}
                  onEndorsementClick={
                    onEndorsementClick ? () => onEndorsementClick(entry) : undefined
                  }
                  shareAction={renderShareAction?.(entry)}
                  endorseAction={renderEndorseAction?.(entry)}
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
  const { data: authData } = useAuthMe();
  const isSuperAdmin = Boolean(authData?.user?.isSuperAdmin);
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
  const [nextOnCourtLayout, setNextOnCourtLayout] = useState<NextOnCourtLayoutMode>("stacked");
  const [endorseTargetEntry, setEndorseTargetEntry] = useState<QueueEntryView | null>(null);
  const [endorseListTargetEntry, setEndorseListTargetEntry] = useState<QueueEntryView | null>(null);
  const [spectatorSharePreviewEntry, setSpectatorSharePreviewEntry] =
    useState<QueueEntryView | null>(null);
  const [organizerSharedPreviewEntry, setOrganizerSharedPreviewEntry] =
    useState<QueueEntryView | null>(null);
  const [undefeatedHistoryEntry, setUndefeatedHistoryEntry] = useState<QueueEntryView | null>(null);
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
    setShowCourts(loadShowCourts());
    setNextOnCourtLayout(loadNextOnCourtLayoutMode());
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
    ...operatorShellQueryOptions,
  });

  const operatorQueueQuery = useQuery({
    queryKey: operatorQueueQueryKey(gameId),
    queryFn: () => fetchOperatorQueue(gameId),
    enabled: !!gameId && operatorCanLoadData,
    ...operatorQueueQueryOptions,
  });

  const openQrRegistrationDialog = useCallback(async () => {
    try {
      const shellGame = operatorShellQuery.data?.game;
      const queuePayload = operatorQueueQuery.data;
      const canProceed = await promptIfRegistrationFullFromSession({
        gameId,
        status: queuePayload?.status ?? shellGame?.status ?? "active",
        strictPlayerCount: shellGame?.strictPlayerCount,
        expectedPlayers: shellGame?.expectedPlayers,
        allowQrRegistration: shellGame?.allowQrRegistration,
        queue: queuePayload?.queue ?? [],
        checkedOut: queuePayload?.checkedOut ?? [],
        courts: queuePayload?.courts ?? [],
      });
      if (!canProceed) return;

      setQrDialogOpen(true);

      const cachedQr =
        qrDialogData ??
        (shellGame?.registerUrl && shellGame?.publicQrCodeDataUrl
          ? {
              registerUrl: shellGame.registerUrl,
              publicQrCodeDataUrl: shellGame.publicQrCodeDataUrl,
            }
          : null);

      if (cachedQr) {
        if (!qrDialogData) {
          setQrDialogData(cachedQr);
        }
        return;
      }

      setQrDialogLoading(true);
      const payload = await fetchGameRegistrationQr(gameId);
      setQrDialogData({
        registerUrl: payload.registerUrl,
        publicQrCodeDataUrl: payload.publicQrCodeDataUrl,
      });
    } catch (error) {
      setQrDialogOpen(false);
      toastOperationError(error, "Could not load registration QR.");
    } finally {
      setQrDialogLoading(false);
    }
  }, [
    gameId,
    operatorQueueQuery.data,
    operatorShellQuery.data?.game,
    qrDialogData,
  ]);

  useEffect(() => {
    if (isQuickGameSession || isSpectator || !gameId || !operatorCanLoadData) return;

    const shellGame = operatorShellQuery.data?.game;
    if (!shellGame || shellGame.allowQrRegistration === false) return;
    if (qrDialogData || (shellGame.registerUrl && shellGame.publicQrCodeDataUrl)) return;

    let cancelled = false;
    void fetchGameRegistrationQr(gameId)
      .then((payload) => {
        if (cancelled) return;
        setQrDialogData({
          registerUrl: payload.registerUrl,
          publicQrCodeDataUrl: payload.publicQrCodeDataUrl,
        });
      })
      .catch(() => {
        // Prefetch is best-effort; click handler retries with user feedback.
      });

    return () => {
      cancelled = true;
    };
  }, [
    gameId,
    isQuickGameSession,
    isSpectator,
    operatorCanLoadData,
    operatorShellQuery.data?.game,
    qrDialogData,
  ]);

  const operatorGameStatus =
    operatorQueueQuery.data?.status ?? operatorShellQuery.data?.game.status;
  const nextCourtAnalysisPrefetchEnabled =
    !isSpectator &&
    isDoublesMatchupAnalysisMatchingType(
      operatorShellQuery.data?.game.matchingType,
      operatorShellQuery.data?.game.gameMode,
    ) &&
    (operatorQueueQuery.data?.queue.length ?? 0) >= DOUBLES_PLAYERS_PER_COURT;
  const operatorMatchHistoryEnabled =
    !isSpectator &&
    (showMatchHistory ||
      mobileDashboardTab === "history" ||
      undefeatedHistoryEntry != null ||
      nextCourtAnalysisPrefetchEnabled);

  const operatorMatchHistoryQuery = useQuery({
    queryKey: operatorMatchHistoryQueryKey(gameId),
    queryFn: () => fetchOperatorMatchHistory(gameId),
    enabled:
      !!gameId &&
      !isQuickGameSession &&
      Boolean(operatorShellQuery.data) &&
      operatorMatchHistoryEnabled,
    ...operatorMatchHistoryQueryOptions,
  });

  useOperatorQueueRegistrationSync({
    gameId,
    enabled:
      operatorCanLoadData &&
      !isQuickGameSession &&
      !!gameId &&
      hasDashboardLease &&
      operatorQueueQuery.data?.status !== "ended" &&
      operatorQueueQuery.data?.status !== "draft",
    queueQuery: operatorQueueQuery,
  });

  const spectatorLiveQuery = useQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live") as Promise<SpectateLivePayload>,
    enabled: !!gameId && isSpectator,
    ...spectatorLiveQueryOptions,
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
  const spectatorMatchHistoryEnabled =
    isSpectator &&
    (showMatchHistory ||
      (isLgViewport === false && mobileDashboardTab === "history") ||
      undefeatedHistoryEntry != null);
  const spectatorRecapEnabled = isSpectator && spectatorGameStatus === "ended";

  const spectatorMatchHistoryQuery = useQuery({
    queryKey: spectatorMatchHistoryQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "history"),
    enabled: !!gameId && spectatorMatchHistoryEnabled,
    ...spectatorMatchHistoryQueryOptions,
  });

  const spectatorRecapQuery = useQuery({
    queryKey: spectatorRecapQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "recap"),
    enabled: !!gameId && spectatorRecapEnabled,
    ...spectatorRecapQueryOptions,
  });

  const data = useMemo((): GamePayload | undefined => {
    if (isQuickGameSession) {
      return quickSession;
    }
    if (isSpectator) {
      if (!spectatorLiveQuery.data) return undefined;
      return mergeSpectatorGamePayload(
        spectatorLiveQuery.data,
        null,
        spectatorMatchHistoryQuery.data,
        spectatorRecapQuery.data,
      ) as GamePayload;
    }
    const shell = operatorShellQuery.data ?? operatorPlaceholderShell(gameId);
    return mergeOperatorGamePayload(
      shell,
      operatorQueueQuery.data,
      null,
      operatorMatchHistoryQuery.data,
    );
  }, [
    gameId,
    isQuickGameSession,
    isSpectator,
    quickSession,
    operatorMatchHistoryQuery.data,
    operatorQueueQuery.data,
    operatorShellQuery.data,
    spectatorMatchHistoryQuery.data,
    spectatorRecapQuery.data,
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

  const handleSpectatorMatchHistoryRefresh = useCallback(() => {
    setSpectatorManualDetailsRefresh(true);
    void spectatorMatchHistoryQuery.refetch().finally(() => {
      setSpectatorManualDetailsRefresh(false);
    });
  }, [spectatorMatchHistoryQuery]);

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
    onMutate: (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (previous) {
        const optimistic = applyFillNextCourtOptimistic(previous, courtNumber);
        if (optimistic) {
          writeOperatorGamePayload(queryClient, gameId, optimistic);
        }
      }
      void queryClient.cancelQueries({ queryKey: ["game", gameId] });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Next court filled from the queue.");
    },
    onSettled: () => {
      if (!isQuickGameSession) {
        void queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
      }
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to fill court.");
    },
  });

  const closeEndDialog = useCallback(() => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  }, []);

  const openEndGameDialog = useCallback((courtNumber: number) => {
    setEndTargetCourt(courtNumber);
    setPendingWinner(null);
    setTeamAScore("");
    setTeamBScore("");
    setEndGameRematch(false);
  }, []);

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
    onMutate: (variables) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (previous) {
        const optimistic = isQuickGameSession
          ? applyEndGameWithHistoryOptimistic(previous, variables)
          : applyEndGameOptimistic(previous, variables);
        if (optimistic) {
          writeOperatorGamePayload(queryClient, gameId, optimistic);
        }
      }

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
      void queryClient.cancelQueries({ queryKey: ["game", gameId] });
      return { previous, previousRematchCourtNumbers };
    },
    onSuccess: (data, variables) => {
      toast.success(data.message ?? "Court updated.");
      void announceCourtEnded(variables.courtNumber);
    },
    onSettled: () => {
      if (!isQuickGameSession) {
        void queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
        if (operatorMatchHistoryEnabled) {
          void queryClient.refetchQueries({ queryKey: operatorMatchHistoryQueryKey(gameId) });
        }
      }
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

  const handleSubmitEndGame = useCallback(
    (input: {
      winnerTeam: "A" | "B";
      teamAScore: number;
      teamBScore: number;
      rematch: boolean;
    }) => {
      if (endTargetCourt == null) return;
      endMutation.mutate({
        courtNumber: endTargetCourt,
        ...input,
      });
    },
    [endMutation, endTargetCourt],
  );

  const shuffleNextMutation = useMutation({
    mutationFn: async () => {
      if (isQuickGameSession) {
        const previous = readOperatorGamePayload(queryClient, gameId);
        if (!previous) throw new Error("Session not found.");
        const optimistic = applyShuffleNextOptimistic(previous);
        if (!optimistic) throw new Error("Not enough queued players.");
        writeOperatorGamePayload(queryClient, gameId, optimistic);
        return { message: "Optimized next four for best balance." };
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
    onMutate: (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (previous) {
        const optimistic = applyCancelCourtAssignmentOptimistic(previous, courtNumber);
        if (optimistic) {
          writeOperatorGamePayload(queryClient, gameId, optimistic);
        }
      }

      const previousRematchCourtNumbers = new Set(rematchCourtNumbers);
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      setCancelCourtTarget(null);
      void queryClient.cancelQueries({ queryKey: ["game", gameId] });
      return { previous, previousRematchCourtNumbers };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      if (!isQuickGameSession) {
        void queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
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
    onMutate: (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (previous) {
        const optimistic = applyCancelRematchOptimistic(previous, courtNumber);
        if (optimistic) {
          writeOperatorGamePayload(queryClient, gameId, optimistic);
        }
      }
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      setCancelRematchTarget(null);
      void queryClient.cancelQueries({ queryKey: ["game", gameId] });
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      if (!isQuickGameSession) {
        void queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
      }
    },
    onError: (error, _courtNumber, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to cancel rematch.");
    },
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

  const addCourtMutation = useMutation({
    mutationFn: async () => {
      if (!isQuickGameSession) throw new Error("Court add is only available in quick play sessions.");
      return { message: "Court added." };
    },
    onMutate: async () => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined as GamePayload | undefined };
      const optimistic = addLocalCourt(previous, MAX_QUICK_PLAY_COURTS);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        writeOperatorGamePayload(queryClient, gameId, context.previous);
      }
      toastOperationError(error, "Failed to add court.");
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

      const optimistic = usesWinnerLoserRotation
        ? applyQueueSwapByIndexOptimistic(
            previous,
            variables.sourceIndex,
            variables.targetIndex,
          )
        : applyQueueSwapOptimistic(previous, variables);
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
        void queryClient.invalidateQueries({ queryKey: databaseCheckInPlayersQueryKey(gameId) });
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
  const leaderboardRankMap = useMemo(
    () =>
      buildSessionLeaderboardRankMap(data?.leaderboard, [
        ...queueWithStats,
        ...checkedOutWithStats,
      ]),
    [data?.leaderboard, queueWithStats, checkedOutWithStats],
  );
  const matchingType = data?.game?.matchingType;
  const usesWinnerLoserRotation = isDoublesWinnerLoserRotation(matchingType);
  const usesMixedDoubles = isMixedDoublesMatching(matchingType);
  const rotationQueue = useMemo(
    () =>
      usesWinnerLoserRotation && data?.queue
        ? resolveDoublesRotationQueue(data.queue, matchingType)
        : (data?.queue ?? []),
    [data?.queue, matchingType, usesWinnerLoserRotation],
  );
  const nextCourtFoursome = useMemo(() => {
    if (!data?.queue) return null;
    const foursome = pickDoublesCourtFoursome(data.queue, matchingType);
    if (!foursome) return null;
    const byId = new Map(queueWithStats.map((entry) => [entry._id, entry]));
    return foursome
      .map((entry) => byId.get(entry._id))
      .filter((entry): entry is (typeof queueWithStats)[number] => entry != null);
  }, [data?.queue, matchingType, queueWithStats]);
  const nextCourtFoursomeIds = useMemo(
    () => new Set(nextCourtFoursome?.map((entry) => entry._id) ?? []),
    [nextCourtFoursome],
  );
  const rotationQueueSegments = useMemo(() => {
    if (!usesWinnerLoserRotation) return null;
    const orderedWithStats = rotationQueue
      .map((entry) => queueWithStats.find((row) => row._id === entry._id))
      .filter((entry): entry is (typeof queueWithStats)[number] => entry != null);
    return segmentDoublesQueueDisplay(orderedWithStats, nextCourtFoursomeIds);
  }, [nextCourtFoursomeIds, queueWithStats, rotationQueue, usesWinnerLoserRotation]);
  const queueDisplayEntries = useMemo(() => {
    if (!usesWinnerLoserRotation || !rotationQueueSegments) {
      return queueWithStats;
    }
    return [
      ...(nextCourtFoursome ?? []),
      ...rotationQueueSegments.normalWaiting,
      ...rotationQueueSegments.winners,
      ...rotationQueueSegments.losers,
    ];
  }, [nextCourtFoursome, queueWithStats, rotationQueueSegments, usesWinnerLoserRotation]);
  const matchupAnalysisQueue = useMemo(
    () => (usesWinnerLoserRotation ? queueDisplayEntries : queueWithStats),
    [queueDisplayEntries, queueWithStats, usesWinnerLoserRotation],
  );
  const queueDisplayEntryIds = useMemo(
    () => queueDisplayEntries.map((entry) => entry._id),
    [queueDisplayEntries],
  );
  const queueIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rotationQueue.forEach((entry, index) => map.set(entry._id, index));
    return map;
  }, [rotationQueue]);
  const waitingLineEntries = useMemo(() => {
    if (usesWinnerLoserRotation) {
      return queueWithStats.filter((entry) => !nextCourtFoursomeIds.has(entry._id));
    }
    return queueWithStats.slice(DOUBLES_PLAYERS_PER_COURT);
  }, [queueWithStats, usesWinnerLoserRotation, nextCourtFoursomeIds]);

  const handleFillCourtQueueSwap = useCallback(async () => {
    const order = buildQueueNextCourtWaitingSwapOrder(matchupAnalysisQueue);
    if (!order) {
      toast.error("Need at least six players in the queue to swap.");
      return;
    }
    await reorderQueueMutation.mutateAsync(order);
    toast.success("Swapped in the next two players from the waiting line.");
  }, [matchupAnalysisQueue, reorderQueueMutation]);

  const sessionPlayerLookup = useMemo(
    () =>
      buildSessionPlayerLookup({
        queue: queueWithStats,
        checkedOut: checkedOutWithStats,
        courts: data?.courts ?? [],
      }),
    [checkedOutWithStats, data?.courts, queueWithStats],
  );

  /** Re-read on every queue update so highlight never drops after refetch or reorder. */
  const selfHighlightPlayerId = useMemo(
    () => (gameId ? getActiveQueueHighlightPlayerId(gameId) : null),
    [gameId, data?.queue],
  );
  const selfPlayerIds = useMemo(
    () => (gameId ? getActiveQueueHighlightPlayerIds(gameId) : []),
    [gameId, data?.queue],
  );
  const endorserPlayerId = selfPlayerIds[0] ?? selfHighlightPlayerId ?? "";
  const showLiveEndorsements =
    Boolean(gameId) &&
    (isSpectator
      ? spectatorGameStatus !== "ended" && data?.game?.status !== "ended"
      : operatorGameStatus !== "ended" && operatorGameStatus !== "draft");
  const showEndorsementCounts =
    Boolean(gameId) &&
    !isQuickGameSession &&
    (showLiveEndorsements ||
      (isSpectator &&
        (spectatorGameStatus === "ended" || data?.game?.status === "ended")));
  const { data: myPlayerEndorsements = [] } = useQuery({
    queryKey: spectatePlayerEndorsementsQueryKey(gameId, endorserPlayerId),
    queryFn: () => fetchSpectatePlayerEndorsements(gameId, endorserPlayerId),
    enabled:
      isSpectator &&
      showLiveEndorsements &&
      Boolean(endorserPlayerId),
    ...spectatorEndorsementQueryOptions,
  });
  const endorsedPlayerIds = useMemo(
    () => new Set(myPlayerEndorsements.map((item) => item.endorsedPlayerId)),
    [myPlayerEndorsements],
  );
  const { data: gameEndorsementCounts = {} } = useQuery({
    queryKey: spectateGameEndorsementCountsQueryKey(gameId),
    queryFn: () => fetchSpectateGameEndorsementCounts(gameId),
    enabled: showEndorsementCounts,
    ...spectatorEndorsementQueryOptions,
    refetchInterval: () => {
      if (!showLiveEndorsements) return false;
      return isSpectator ? SPECTATOR_LIVE_POLL_MS : OPERATOR_QUEUE_STALE_TIME_MS;
    },
  });
  const { data: shareCardClubBranding } = useQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live"),
    select: (live) => live.clubBranding ?? null,
    enabled: Boolean(gameId) && !isSpectator && !isQuickGameSession,
    ...spectatorLiveQueryOptions,
  });

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
    if (operatorMatchHistoryQuery.isLoading && !operatorMatchHistoryQuery.data) {
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
    if (spectatorMatchHistoryQuery.isLoading && !spectatorMatchHistoryQuery.data) {
      return "Loading match history…";
    }
    return `${matches.length} ${matches.length === 1 ? "match" : "matches"} recorded`;
  })();

  const spectatorMatchHistoryEmptyMessage = "No matches recorded for this session yet.";

  const quickGameHomeHref = isEphemeralQuickSession ? "/play" : "/";
  const leaderboardHref = buildSpectatorLeaderboardHref(game.gameId);

  const isCourtRematch = (court: CourtView) =>
    court.isRematch === true || rematchCourtNumbers.has(court.courtNumber);

  const openPlayDateLabel = formatOpenPlayDate(game.openPlayDate);
  const openPlayTimeLabel = game.openPlayTimeRange?.trim() || null;
  const openPlayScheduleLabel = formatOpenPlayScheduleLabel(
    game.openPlayDate,
    game.openPlayTimeRange,
  );
  const venueShareLabel = formatVenueShareLabel(game.venueName, game.venueAddress);
  const isPastGame = game.status === "ended";
  const birthdayThisMonthCount = isSpectator
    ? (spectatorLiveQuery.data?.birthdayThisMonthCount ?? 0)
    : (operatorQueueQuery.data?.birthdayThisMonthCount ?? 0);
  const firstTimerCount = isSpectator
    ? (spectatorLiveQuery.data?.firstTimerCount ?? 0)
    : (operatorQueueQuery.data?.firstTimerCount ?? 0);
  const showSpectatorEndedRecap = isSpectator && isPastGame;
  const canResetGame =
    !isQuickGameSession &&
    !isPastGame &&
    (isDemoOpenPlayTitle(game.title) || isSuperAdmin);
  const hideControls =
    readOnly ||
    isPastGame ||
    (!isQuickGameSession && operatorLeasePending) ||
    (!isQuickGameSession && !hasDashboardLease) ||
    operatorQueueLoading;
  const canReorderQueue = !hideControls && queueDisplayEntries.length >= 2;
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
  const showManualCourtAdd =
    !readOnly &&
    !isPastGame &&
    isQuickGameSession &&
    (game.registrationMode === "owner" || game.registrationMode == null) &&
    game.allowManualCourtAdd === true;
  const canAddMoreCourts = courts.length < MAX_QUICK_PLAY_COURTS;
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
      title: "Reset Open Play?",
      text: "This clears matches and the leaderboard, then rebuilds the queue.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, reset",
      cancelButtonText: "Cancel",
    });
    if (result.isConfirmed) resetMutation.mutate();
  };

  const renderSpectatorEndorseAction = (entry: QueueEntryView, compact?: boolean) => {
    if (!isSpectator || isPastGame) return undefined;

    const playerId = queueEntryPlayerId(entry);
    if (!playerId) return undefined;

    if (!endorserPlayerId) {
      return undefined;
    }

    const isSelf = selfPlayerIds.includes(playerId);

    if (isSelf) {
      return undefined;
    }

    const endorsed = endorsedPlayerIds.has(playerId);

    if (endorsed) {
      return undefined;
    }

    return (
      <SpectatorPlayerEndorseButton
        compact={compact}
        onClick={() => setEndorseTargetEntry(entry)}
      />
    );
  };

  const renderSpectatorShareAction = (entry: QueueEntryView, compact?: boolean) => {
    if (!isSpectator || isPastGame) return undefined;

    const playerId = queueEntryPlayerId(entry);
    if (!playerId) return undefined;

    return (
      <SpectatorPlayerCardShareButton
        compact={compact}
        onOpen={() => setSpectatorSharePreviewEntry(entry)}
      />
    );
  };

  const getPlayerEndorsementCount = (entry: QueueEntryView) => {
    const playerId = queueEntryPlayerId(entry);
    return playerId ? (gameEndorsementCounts[playerId] ?? 0) : 0;
  };

  const showSpectatorEndorsementInPlayerLabel = isSpectator && showLiveEndorsements;

  const openEndorseListForPlayer = (player: QueueEntryView["playerId"]) => {
    const playerId = player._id != null ? String(player._id) : "";
    if (!playerId || (gameEndorsementCounts[playerId] ?? 0) <= 0) return;
    setEndorseListTargetEntry({
      _id: `endorse-list-${playerId}`,
      queueType: "normal",
      playerId: player,
      registeredAt: "",
      lastMatchResult: "none",
    });
  };

  const openEndorseListForLeaderboardRow = (row: LeaderboardRow) => {
    const playerId = row.playerId ?? row.id;
    if (!playerId || (gameEndorsementCounts[playerId] ?? 0) <= 0) return;
    setEndorseListTargetEntry({
      _id: `leaderboard-${playerId}`,
      queueType: "normal",
      playerId: {
        ...row,
        _id: playerId,
      },
      registeredAt: "",
      lastMatchResult: "none",
    });
  };

  const openLeaderboardPodiumShare = (row: LeaderboardRow) => {
    setSpectatorSharePreviewEntry(leaderboardRowToShareEntry(row));
  };

  const openOrganizerSharedPreview = (entry: QueueEntryView) => {
    if (!entry.cardSharedAt) return;
    setOrganizerSharedPreviewEntry(entry);
  };

  const openUndefeatedHistory = (entry: QueueEntryView) => {
    const wins = entry.wins ?? 0;
    const losses = entry.losses ?? 0;
    if (!isSessionUndefeated({ wins, losses })) return;
    setUndefeatedHistoryEntry(entry);
  };

  const showUndefeatedForEntry = (entry: QueueEntryView) =>
    isSessionUndefeated({ wins: entry.wins ?? 0, losses: entry.losses ?? 0 });

  const renderQueueEntryRow = (
    entry: QueueEntryView,
    index: number,
    drag?: QueueDragHandleProps,
    options?: {
      compactName?: boolean;
      hideSessionStats?: boolean;
      showSessionRecordBelowName?: boolean;
      showSessionRecordInPillSlot?: boolean;
    },
  ) => {
    const isNextUp = nextCourtFoursomeIds.has(entry._id);
    const queueIndex = queueIndexById.get(entry._id) ?? index;
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
                  sourceIndex: usesWinnerLoserRotation ? queueIndex : index,
                  sourceEntry: entry,
                })
        }
        replacePending={
          !hideControls &&
          replaceMutation.isPending &&
          replaceMutation.variables?.sourceIndex ===
            (usesWinnerLoserRotation ? queueIndex : index)
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
        showSessionRecordBelowName={options?.showSessionRecordBelowName}
        showSessionRecordInPillSlot={options?.showSessionRecordInPillSlot}
        dragHandle={
          drag ? (
            <QueueDragHandle
              {...drag}
              slot={index + 1}
              label={`Reorder ${formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName)} in queue`}
            />
          ) : undefined
        }
        showLeaderboardRank
        leaderboardRankMap={leaderboardRankMap}
        showCardSharedStatus={!isSpectator && !hideControls}
        onSharedClick={
          !isSpectator && !hideControls && entry.cardSharedAt
            ? () => openOrganizerSharedPreview(entry)
            : undefined
        }
        onUndefeatedClick={showUndefeatedForEntry(entry) ? () => openUndefeatedHistory(entry) : undefined}
        showEndorsementStatus={!isSpectator && !hideControls}
        showEndorsementInPlayerLabel={showSpectatorEndorsementInPlayerLabel}
        endorsementCount={getPlayerEndorsementCount(entry)}
        onEndorsementClick={
          getPlayerEndorsementCount(entry) > 0 &&
          (showSpectatorEndorsementInPlayerLabel || (!isSpectator && !hideControls))
            ? () => setEndorseListTargetEntry(entry)
            : undefined
        }
        endorseAction={renderSpectatorEndorseAction(entry, options?.compactName)}
        shareAction={renderSpectatorShareAction(entry, options?.compactName)}
      />
    );
  };

  const renderQueuedEntry = (
    entry: QueueEntryView,
    index: number,
    options?: {
      sortable?: boolean;
      compactName?: boolean;
      hideSessionStats?: boolean;
      showSessionRecordBelowName?: boolean;
      showSessionRecordInPillSlot?: boolean;
    },
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
    waitingLineView === "list"
      ? usesWinnerLoserRotation
        ? queueDisplayEntryIds
        : queueEntryIds
      : usesWinnerLoserRotation
        ? queueDisplayEntryIds
        : queueEntryIds.slice(0, DOUBLES_PLAYERS_PER_COURT);
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
  const fillableEmptyCourts = emptyCourts;
  const nextEmptyCourt = fillableEmptyCourts[0] ?? null;
  const emptyCourtNumbers = fillableEmptyCourts.map((court) => court.courtNumber);
  const courtsClearingInProgress = courts.some(
    (court) => clearingCourtNumbers.has(court.courtNumber) && court.status === "active",
  );
  const canFillNextCourt =
    pickDoublesCourtFoursome(data.queue, game.matchingType) != null && nextEmptyCourt != null;
  const fillCourtTeamA = (nextCourtFoursome ?? queueWithStats.slice(0, 2)).slice(0, 2);
  const fillCourtTeamB = (nextCourtFoursome ?? queueWithStats.slice(0, 4)).slice(2, 4);
  const showNextCourtAnalysis =
    !isSpectator &&
    isDoublesMatchupAnalysisMatchingType(matchingType, game.gameMode) &&
    (nextCourtFoursome?.length ?? 0) === DOUBLES_PLAYERS_PER_COURT;
  const nextOnCourtPlayerCount =
    nextCourtFoursome?.length ?? Math.min(DOUBLES_PLAYERS_PER_COURT, queueWithStats.length);
  const fillingCourtNumber =
    startMutation.isPending && startMutation.variables != null ? startMutation.variables : null;
  const endCourt =
    endTargetCourt != null ? courts.find((c) => c.courtNumber === endTargetCourt) : undefined;
  const endGameScoreError =
    pendingWinner != null
      ? getMatchScoreInputError(pendingWinner, teamAScore, teamBScore, { required: true })
      : null;

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
                    <div className="queue-next-up-banner__header">
                      <span className="queue-next-up-icon" aria-hidden>
                        <Zap className="h-4 w-4" />
                      </span>
                      <div className="queue-next-up-banner__heading">
                        <p className="queue-next-up-title">
                          <span className="xl:hidden">Next</span>
                          <span className="hidden xl:inline">Next on court</span>
                        </p>
                        <p className="queue-next-up-subtitle caption">
                          {showNextCourtAnalysis
                            ? `Slots 1–2 vs 3–4${canReorderQueue ? " · drag to reorder" : ""}`
                            : usesWinnerLoserRotation
                              ? "Next four in queue order — complete bracket foursomes move to the end of the main line"
                              : formatDoublesNextOnCourtSubtitle(nextOnCourtPlayerCount, {
                                  canReorder: canReorderQueue,
                                })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 self-start sm:flex-row sm:items-center">
                        {game.gameMode !== "singles" ? (
                          <NextOnCourtLayoutToggle
                            layout={nextOnCourtLayout}
                            onLayoutChange={(mode) => {
                              setNextOnCourtLayout(mode);
                              saveNextOnCourtLayoutMode(mode);
                            }}
                            className="hidden xl:inline-flex"
                          />
                        ) : null}
                        <Badge className="badge-next-up-count">
                          {nextCourtFoursome?.length ?? 0} / {DOUBLES_PLAYERS_PER_COURT}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {showNextCourtAnalysis && nextCourtFoursome ? (
                    <NextCourtMatchAnalysis
                      foursome={nextCourtFoursome}
                      queue={matchupAnalysisQueue}
                      matchingType={matchingType}
                      matches={matches}
                      matchesLoading={
                        !isQuickGameSession &&
                        operatorMatchHistoryQuery.isLoading &&
                        !operatorMatchHistoryQuery.data
                      }
                      onShuffle={canReorderQueue ? handleFillCourtShuffle : undefined}
                      shufflePending={shuffleNextMutation.isPending}
                      onSwapWaiting={canReorderQueue ? handleFillCourtQueueSwap : undefined}
                      swapWaitingPending={reorderQueueMutation.isPending}
                      maxVisible={compactQueue ? 1 : 2}
                    />
                  ) : null}
                  <QueueNextUpSlots
                    entries={nextCourtFoursome ?? queueWithStats.slice(0, DOUBLES_PLAYERS_PER_COURT)}
                    showDoublesTeamPreview={game.gameMode !== "singles"}
                    layout={nextOnCourtLayout}
                    compactName={compactQueue}
                    renderEntry={(entry, index, options) =>
                      renderQueuedEntry(entry, index, options)
                    }
                  />
                </QueueDndZone>
                {usesWinnerLoserRotation && rotationQueueSegments ? (
                  <QueueDndZone zone="waiting" className="queue-waiting-group">
                    {rotationQueueSegments.normalWaiting.length > 0 ? (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Waiting in line
                        </p>
                        {rotationQueueSegments.normalWaiting.map((entry, offset) =>
                          renderQueuedEntry(entry, offset + DOUBLES_PLAYERS_PER_COURT, {
                            compactName: compactQueue,
                          }),
                        )}
                      </div>
                    ) : null}
                    {rotationQueueSegments.winners.length > 0 ? (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Winners
                        </p>
                        {rotationQueueSegments.winners.map((entry, offset) =>
                          renderQueuedEntry(entry, offset + DOUBLES_PLAYERS_PER_COURT, {
                            compactName: compactQueue,
                          }),
                        )}
                      </div>
                    ) : null}
                    {rotationQueueSegments.losers.length > 0 ? (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Losers
                        </p>
                        {rotationQueueSegments.losers.map((entry, offset) =>
                          renderQueuedEntry(entry, offset + DOUBLES_PLAYERS_PER_COURT, {
                            compactName: compactQueue,
                          }),
                        )}
                      </div>
                    ) : null}
                  </QueueDndZone>
                ) : queueWithStats.length > DOUBLES_PLAYERS_PER_COURT ? (
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
                            Show waiting list ({queueWithStats.length - DOUBLES_PLAYERS_PER_COURT})
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
                            renderQueuedEntry(entry, offset + DOUBLES_PLAYERS_PER_COURT, {
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
                              hideSessionStats: compactQueue && isLgViewport !== true,
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
                onSharedClick={!isSpectator ? openOrganizerSharedPreview : undefined}
                onUndefeatedClick={openUndefeatedHistory}
                showEndorsementStatus={!isSpectator && !hideControls}
                showEndorsementInPlayerLabel={showSpectatorEndorsementInPlayerLabel}
                getEndorsementCount={getPlayerEndorsementCount}
                onEndorsementClick={(entry) => setEndorseListTargetEntry(entry)}
                renderShareAction={
                  isSpectator ? (entry) => renderSpectatorShareAction(entry) : undefined
                }
                renderEndorseAction={
                  isSpectator ? (entry) => renderSpectatorEndorseAction(entry) : undefined
                }
                showLeaderboardRank
                leaderboardRankMap={leaderboardRankMap}
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
                : () => openEndGameDialog(court.courtNumber)
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
            mixedDoubles={usesMixedDoubles}
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
            isFilling={
              fillingCourtNumber != null &&
              court.courtNumber === fillingCourtNumber &&
              court.status !== "active"
            }
            isClearing={
              clearingCourtNumbers.has(court.courtNumber) && court.status === "active"
            }
            onFillCourt={
              hideControls || court.status !== "empty"
                ? undefined
                : () => fillCourtFlowRef.current?.openFillCourt(court.courtNumber)
            }
            canFillCourt={
              !hideControls &&
              court.status === "empty" &&
              pickDoublesCourtFoursome(data.queue, game.matchingType) != null
            }
            fillCourtPending={
              startMutation.isPending && startMutation.variables === court.courtNumber
            }
            showEndorsementInPlayerLabel={showSpectatorEndorsementInPlayerLabel}
            getPlayerEndorsementCount={(playerId) => gameEndorsementCounts[playerId] ?? 0}
            onPlayerEndorsementClick={
              showSpectatorEndorsementInPlayerLabel ? openEndorseListForPlayer : undefined
            }
          />
        ))
        )}
        {showManualCourtAdd ? (
          <AddCourtButton
            onClick={() => addCourtMutation.mutate()}
            pending={addCourtMutation.isPending}
            disabled={!canAddMoreCourts}
          />
        ) : null}
      </CardContent>
    </Card>
    );
  };

  const renderMatchHistoryPanel = (inSpectatorMobileTab = false) => {
    const historyMatches = matches;
    const panelVisible = inSpectatorMobileTab || showMatchHistory;
    const historyQuery = isSpectator ? spectatorMatchHistoryQuery : operatorMatchHistoryQuery;
    const spectatorHistoryRefreshStatus =
      isSpectator && panelVisible
        ? getSpectatorPanelRefreshStatus(
            historyQuery.isFetching,
            historyQuery.isLoading,
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
                      handleSpectatorMatchHistoryRefresh();
                    } else {
                      void historyQuery.refetch();
                    }
                  }}
                  disabled={historyQuery.isFetching}
                  aria-label="Refresh match history"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", historyQuery.isFetching && "animate-spin")}
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
            {historyQuery.isLoading && !historyQuery.data ? (
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
                {!operatorShellLoading ? (
                  <OpenPlaySkillLevelPills
                    openPlayType={game.openPlayType}
                    className="mt-1"
                  />
                ) : null}
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
                {!operatorShellLoading ? (
                  <GameFormatHeaderBadges
                    gameMode={game.gameMode}
                    matchingType={game.matchingType}
                  />
                ) : null}
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
                onMouseEnter={() => prefetchLeaderboardRecap(queryClient, gameId, true)}
                onFocus={() => prefetchLeaderboardRecap(queryClient, gameId, true)}
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
                showResetOpenPlay={!readOnly && canResetGame}
                resetOpenPlayPending={resetMutation.isPending}
                onResetOpenPlay={handleResetGame}
                showEndOpenPlay={!readOnly && !isPastGame}
                endOpenPlayPending={endOpenPlayMutation.isPending}
                onEndOpenPlay={handleEndOpenPlay}
              />
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
            endorsementCounts={gameEndorsementCounts}
            onEndorsementClick={openEndorseListForLeaderboardRow}
            onPodiumShareClick={openLeaderboardPodiumShare}
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
                    count: (isSpectator ? spectatorMatchHistoryQuery.data : operatorMatchHistoryQuery.data)
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

      {!isPastGame && !hideControls && usesWinnerLoserRotation && emptyCourts.length > 0 && !canFillNextCourt && queueWithStats.length > 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Need four players in the queue. The next court always takes the first four waiting in line.
        </p>
      ) : null}

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
              mixedDoubles={usesMixedDoubles}
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
            nextUpCount={usesWinnerLoserRotation ? DOUBLES_PLAYERS_PER_COURT : undefined}
            resolveTargetIndex={
              usesWinnerLoserRotation
                ? (entry) => queueIndexById.get(entry._id) ?? -1
                : undefined
            }
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

      {!readOnly && (resolvedQrDialogData || qrDialogOpen) ? (
        <GameQrDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          gameTitle={game.title}
          registerUrl={resolvedQrDialogData?.registerUrl ?? ""}
          qrCodeDataUrl={resolvedQrDialogData?.publicQrCodeDataUrl ?? ""}
          loading={qrDialogLoading || !resolvedQrDialogData}
        />
      ) : null}

      {!readOnly ? (
        <CourtEndGameDialog
          open={endTargetCourt !== null}
          endCourt={endCourt}
          playerLookup={sessionPlayerLookup}
          gameMode={game.gameMode ?? "doubles"}
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
          onSubmit={handleSubmitEndGame}
        />
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
          showAddPlayer={showManualAddPlayer}
          onAddPlayerClick={() => setAddPlayerOpen(true)}
          showResetOpenPlay={!readOnly && canResetGame}
          resetOpenPlayPending={resetMutation.isPending}
          onResetOpenPlay={handleResetGame}
          showEndOpenPlay={!readOnly && !isPastGame}
          endOpenPlayPending={endOpenPlayMutation.isPending}
          onEndOpenPlay={handleEndOpenPlay}
        />
      ) : null}

      {isSpectator ? (
        <>
          <SpectatePlayerEndorseDialog
            gameId={gameId}
            endorserPlayerId={endorserPlayerId}
            entry={endorseTargetEntry}
            open={endorseTargetEntry != null}
            onOpenChange={(open) => {
              if (!open) setEndorseTargetEntry(null);
            }}
          />
          {spectatorSharePreviewEntry ? (
            <SpectatorPlayerCardShareDialog
              gameId={gameId}
              entry={spectatorSharePreviewEntry}
              playerId={queueEntryPlayerId(spectatorSharePreviewEntry)!}
              selfPlayerIds={selfPlayerIds}
              gameTitle={game.title}
              clubName={spectatorLiveQuery.data?.clubBranding?.clubName ?? null}
              clubLogoUrl={spectatorLiveQuery.data?.clubBranding?.clubLogoUrl ?? null}
              clubTagline={spectatorLiveQuery.data?.clubBranding?.clubTagline ?? null}
              openPlaySchedule={openPlayScheduleLabel}
              venueLabel={venueShareLabel}
              leaderboardRankMap={leaderboardRankMap}
              open
              onOpenChange={(open) => {
                if (!open) setSpectatorSharePreviewEntry(null);
              }}
            />
          ) : null}
        </>
      ) : null}

      <SpectatePlayerEndorsementsListDialog
        gameId={gameId}
        entry={endorseListTargetEntry}
        open={endorseListTargetEntry != null}
        onOpenChange={(open) => {
          if (!open) setEndorseListTargetEntry(null);
        }}
      />

      {organizerSharedPreviewEntry && queueEntryPlayerId(organizerSharedPreviewEntry) ? (
        <SpectatorPlayerCardShareDialog
          previewOnly
          gameId={gameId}
          entry={organizerSharedPreviewEntry}
          playerId={queueEntryPlayerId(organizerSharedPreviewEntry)!}
          gameTitle={game.title}
          clubName={shareCardClubBranding?.clubName ?? null}
          clubLogoUrl={shareCardClubBranding?.clubLogoUrl ?? null}
          clubTagline={shareCardClubBranding?.clubTagline ?? null}
          openPlaySchedule={openPlayScheduleLabel}
          venueLabel={venueShareLabel}
          leaderboardRankMap={leaderboardRankMap}
          open
          onOpenChange={(open) => {
            if (!open) setOrganizerSharedPreviewEntry(null);
          }}
        />
      ) : null}

      {undefeatedHistoryEntry && queueEntryPlayerId(undefeatedHistoryEntry) ? (
        <PlayerSessionMatchHistoryDialog
          open
          onOpenChange={(open) => {
            if (!open) setUndefeatedHistoryEntry(null);
          }}
          gameId={gameId}
          playerId={queueEntryPlayerId(undefeatedHistoryEntry)!}
          playerName={formatPlayerDisplayName(
            undefeatedHistoryEntry.playerId.firstName,
            undefeatedHistoryEntry.playerId.lastName,
          )}
          wins={undefeatedHistoryEntry.wins ?? 0}
          losses={undefeatedHistoryEntry.losses ?? 0}
          matches={matches}
          isLoading={
            !isQuickGameSession &&
            (isSpectator
              ? spectatorMatchHistoryQuery.isFetching
              : operatorMatchHistoryQuery.isFetching) &&
            matches.length === 0
          }
        />
      ) : null}
    </main>
    </GamePlayerProfileProvider>
  );
}
