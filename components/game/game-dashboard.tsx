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
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { MatchHistoryList, type MatchHistoryView } from "@/components/game/match-history-list";
import {
  CourtsViewToggle,
  saveCourtsView,
  type CourtsViewLayout,
} from "@/components/game/courts-view-toggle";
import {
  COURTS_DESKTOP_MEDIA,
  defaultCourtsView,
  isCourtsDesktopViewport,
} from "@/lib/courts-viewport";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  courts: CourtView[];
  matches: MatchHistoryView[];
};

function getSwapTargetIndex(sourceIndex: number, queueLength: number) {
  const primaryTargetIndex = sourceIndex + 4;
  const fallbackTargetIndex =
    sourceIndex === 2 ? 4 : sourceIndex === 3 ? 5 : primaryTargetIndex;
  if (queueLength > primaryTargetIndex) return primaryTargetIndex;
  if (queueLength > fallbackTargetIndex) return fallbackTargetIndex;
  return -1;
}

const alertBaseOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#ef4444",
};

const WAITING_LIST_STORAGE_KEY = "ccf-queue-waiting-visible";

function loadShowWaitingList() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(WAITING_LIST_STORAGE_KEY) !== "false";
}

function saveShowWaitingList(show: boolean) {
  localStorage.setItem(WAITING_LIST_STORAGE_KEY, show ? "true" : "false");
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
  const gameId = params.id ?? "";
  const queryClient = useQueryClient();
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [courtsView, setCourtsView] = useState<CourtsViewLayout>("list");
  const [showCourtsViewToggle, setShowCourtsViewToggle] = useState(false);
  const [showWaitingList, setShowWaitingList] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  useEffect(() => {
    const syncCourtsViewForViewport = () => {
      const desktop = isCourtsDesktopViewport();
      setShowCourtsViewToggle(desktop);
      setCourtsView(desktop ? defaultCourtsView() : "list");
    };

    syncCourtsViewForViewport();
    setShowWaitingList(loadShowWaitingList());

    const mq = window.matchMedia(COURTS_DESKTOP_MEDIA);
    mq.addEventListener("change", syncCourtsViewForViewport);
    return () => mq.removeEventListener("change", syncCourtsViewForViewport);
  }, []);

  const handleCourtsViewChange = (view: CourtsViewLayout) => {
    setCourtsView(view);
    saveCourtsView(view);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["game", gameId, isSpectator ? "spectator" : "operator"],
    queryFn: () => getGame(gameId, isSpectator) as Promise<GamePayload>,
    enabled: !!gameId,
    refetchInterval: 4000,
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

  const endMutation = useMutation({
    mutationFn: async (winnerTeam: "A" | "B") => {
      const response = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber: endTargetCourt, winnerTeam }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      setEndTargetCourt(null);
      toast.success("Game ended and queue updated.");
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
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const replaceMutation = useMutation({
    mutationFn: async (sourceIndex: number) => {
      const response = await fetch(`/api/games/${gameId}/swap-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIndex }),
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

  const { game, queue, courts, matches } = data;
  const isPastGame = game.status === "ended";
  const hideControls = readOnly || isPastGame;

  return (
    <main
      className={cn(
        "min-h-screen p-4 md:p-6",
        isSpectator && "game-dashboard--spectator",
      )}
    >
      <section className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <Card className="glass-panel game-dashboard-header">
          <CardContent className="game-dashboard-header-content p-4">
            <div className="game-dashboard-header-top">
              <div className="min-w-0">
                <h1 className="page-title">{game.title}</h1>
                {isSpectator ? (
                  <p className="caption mt-1 text-muted-foreground">
                    View only — live queue and courts update automatically
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
                  <Badge variant="outline">Queue: {queue.length}</Badge>
                  <Badge variant={game.status === "ended" ? "destructive" : "outline"}>
                    Status: {game.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="game-toolbar mt-4 flex flex-wrap items-center gap-2">
              {!isSpectator ? (
                <Link href="/">
                  <Button size="lg" variant="outline">
                    <House className="mr-2 h-4 w-4" /> Home
                  </Button>
                </Link>
              ) : null}
              {!readOnly && !isPastGame && game.publicQrCodeDataUrl && game.registerUrl ? (
                <Button size="lg" variant="outline" onClick={() => setQrDialogOpen(true)}>
                  <QrCode className="mr-2 h-4 w-4" /> QR Registration
                </Button>
              ) : null}
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
              {!readOnly ? (
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
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Queue</CardTitle>
              {!hideControls ? (
                <Button onClick={() => startMutation.mutate()}>
                  <Play className="mr-2 h-4 w-4" /> Fill next court
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="queue-list">
              {queue.length === 0 ? (
                <p className="text-muted-foreground">Queue is empty.</p>
              ) : (
                <>
                  {queue.length > 0 ? (
                    <div className="queue-next-up-group">
                      <div className="queue-next-up-banner">
                        <div className="flex items-center gap-2">
                          <span className="queue-next-up-icon">
                            <Zap className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="queue-next-up-title">Next on court</p>
                            <p className="caption">
                              Top {Math.min(4, queue.length)}{" "}
                              {Math.min(4, queue.length) === 1 ? "player" : "players"} — ready to play
                            </p>
                          </div>
                        </div>
                        <Badge className="badge-next-up-count">{Math.min(4, queue.length)} / 4</Badge>
                      </div>
                      <div className="queue-next-up-slots space-y-2">
                        {queue.slice(0, 4).map((entry, index) => {
                          const targetIndex = getSwapTargetIndex(index, queue.length);
                          const targetPlayer = targetIndex >= 0 ? queue[targetIndex] : null;
                          return (
                            <QueueEntryRow
                              key={entry._id}
                              entry={entry}
                              index={index}
                              isNextUp
                              swapTargetIndex={targetIndex}
                              swapTargetPlayer={targetPlayer}
                              onReplace={
                                hideControls ? () => {} : () => replaceMutation.mutate(index)
                              }
                              replacePending={!hideControls && replaceMutation.isPending}
                              hideReplacePanel={hideControls}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {queue.length > 4 ? (
                    <div className="queue-waiting-group">
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
                              Show waiting list ({queue.length - 4})
                            </>
                          )}
                        </Button>
                        <div className="queue-divider" role="separator">
                          <span>Waiting in line</span>
                        </div>
                      </div>
                      {showWaitingList ? (
                        <div id="queue-waiting-list" className="space-y-2">
                          {queue.slice(4).map((entry, offset) => {
                            const index = offset + 4;
                            return (
                              <QueueEntryRow
                                key={entry._id}
                                entry={entry}
                                index={index}
                                isNextUp={false}
                                swapTargetIndex={-1}
                                swapTargetPlayer={null}
                                onReplace={() => {}}
                                replacePending={false}
                                hideReplacePanel
                              />
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel courts-panel">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Courts</CardTitle>
                <CourtsSummary courts={courts} />
              </div>
              {showCourtsViewToggle ? (
                <CourtsViewToggle value={courtsView} onChange={handleCourtsViewChange} />
              ) : null}
            </CardHeader>
            <CardContent
              className={cn(
                "court-grid grid gap-3",
                courtsView === "list"
                  ? "court-grid--list grid-cols-1"
                  : "court-grid--tiles grid-cols-1 md:grid-cols-2",
              )}
            >
              {courts.map((court) => (
                <CourtCard
                  key={court._id}
                  court={court}
                  hideEndGame={hideControls}
                  onEndGame={
                    hideControls ? () => {} : () => setEndTargetCourt(court.courtNumber)
                  }
                  onSwapTeams={
                    hideControls ? undefined : () => swapCourtMutation.mutate(court.courtNumber)
                  }
                  swapPending={
                    swapCourtMutation.isPending &&
                    swapCourtMutation.variables === court.courtNumber
                  }
                />
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="glass-panel match-history-panel">
          <CardHeader>
            <CardTitle>Match History</CardTitle>
            <p className="caption">
              {matches.length} {matches.length === 1 ? "match" : "matches"} recorded
            </p>
          </CardHeader>
          <CardContent>
            <MatchHistoryList matches={matches} />
          </CardContent>
        </Card>
      </section>

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
        <Dialog open={endTargetCourt !== null} onOpenChange={() => setEndTargetCourt(null)}>
          <DialogContent className="court-winner-dialog">
            <DialogHeader>
              <DialogTitle>Who won on Court {endTargetCourt}?</DialogTitle>
            </DialogHeader>
            <div className="court-winner-dialog-actions grid grid-cols-2 gap-3">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="court-winner-btn"
                onClick={() => endMutation.mutate("A")}
              >
                Team A won
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="court-winner-btn"
                onClick={() => endMutation.mutate("B")}
              >
                Team B won
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </main>
  );
}
