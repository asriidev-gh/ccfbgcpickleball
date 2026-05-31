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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { CourtCard, CourtsSummary, type CourtView } from "@/components/game/court-card";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { promptIfRegistrationFull } from "@/components/game/registration-capacity-prompt";
import { MatchHistoryList, type MatchHistoryView } from "@/components/game/match-history-list";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isGameResetEnabled } from "@/lib/feature-flags";
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
  const router = useRouter();
  const gameId = params.id ?? "";
  const queryClient = useQueryClient();
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [pendingWinner, setPendingWinner] = useState<"A" | "B" | null>(null);
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");
  const [showWaitingList, setShowWaitingList] = useState(true);
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
  }, []);

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

  const closeEndDialog = () => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setTeamAScore("");
    setTeamBScore("");
  };

  const endMutation = useMutation({
    mutationFn: async (input: {
      winnerTeam: "A" | "B";
      teamAScore?: number;
      teamBScore?: number;
    }) => {
      const response = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber: endTargetCourt, ...input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      closeEndDialog();
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
    onSuccess: async (payload) => {
      toast.success(payload.message);
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      router.replace("/");
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

  const removeMutation = useMutation({
    mutationFn: async (queueEntryId: string) => {
      const response = await fetch(`/api/games/${gameId}/remove-from-queue`, {
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
    if (result.isConfirmed) removeMutation.mutate(entry._id);
  };

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
  const endCourt =
    endTargetCourt != null ? courts.find((c) => c.courtNumber === endTargetCourt) : undefined;
  const winningPlayers =
    pendingWinner === "A"
      ? (endCourt?.teamA.playerIds ?? [])
      : pendingWinner === "B"
        ? (endCourt?.teamB.playerIds ?? [])
        : [];

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
              {!readOnly && isGameResetEnabled() ? (
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
                              onRemove={
                                hideControls ? undefined : () => confirmRemoveFromQueue(entry)
                              }
                              removePending={
                                !hideControls &&
                                removeMutation.isPending &&
                                removeMutation.variables === entry._id
                              }
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
                                onRemove={
                                  hideControls ? undefined : () => confirmRemoveFromQueue(entry)
                                }
                                removePending={
                                  !hideControls &&
                                  removeMutation.isPending &&
                                  removeMutation.variables === entry._id
                                }
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
            </CardHeader>
            <CardContent className="court-grid court-grid--list grid grid-cols-1 gap-3">
              {courts.map((court) => (
                <CourtCard
                  key={court._id}
                  court={court}
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
            <MatchHistoryList matches={matches} gameId={gameId} editable={!hideControls} />
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
        <Dialog open={endTargetCourt !== null} onOpenChange={(open) => (!open ? closeEndDialog() : undefined)}>
          <DialogContent className="court-winner-dialog">
            <DialogHeader>
              <DialogTitle>
                {pendingWinner
                  ? `Team ${pendingWinner} won — add the score?`
                  : `Who won on Court ${endTargetCourt}?`}
              </DialogTitle>
            </DialogHeader>

            {pendingWinner === null ? (
              <div className="court-winner-dialog-actions grid grid-cols-2 gap-3">
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
                <p className="text-sm text-muted-foreground">
                  Scores are optional. Leave them blank to just record the win.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="team-a-score"
                      className={cn(
                        "text-sm font-medium",
                        pendingWinner === "A" && "text-primary",
                      )}
                    >
                      Team A{pendingWinner === "A" ? " (winner)" : ""}
                    </label>
                    <Input
                      id="team-a-score"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="—"
                      value={teamAScore}
                      onChange={(event) => setTeamAScore(event.target.value)}
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
                      Team B{pendingWinner === "B" ? " (winner)" : ""}
                    </label>
                    <Input
                      id="team-b-score"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="—"
                      value={teamBScore}
                      onChange={(event) => setTeamBScore(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={endMutation.isPending}
                    onClick={() => {
                      setPendingWinner(null);
                      setTeamAScore("");
                      setTeamBScore("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={endMutation.isPending}
                    onClick={() => {
                      const a = teamAScore.trim();
                      const b = teamBScore.trim();
                      const hasAnyScore = a !== "" || b !== "";
                      endMutation.mutate({
                        winnerTeam: pendingWinner,
                        teamAScore: hasAnyScore ? (a === "" ? 0 : Number(a)) : undefined,
                        teamBScore: hasAnyScore ? (b === "" ? 0 : Number(b)) : undefined,
                      });
                    }}
                  >
                    {endMutation.isPending ? "Saving…" : "Confirm"}
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
