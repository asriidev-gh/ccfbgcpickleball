"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Eye, Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { CreateGameWizard } from "@/components/game/create-game-wizard";
import { GameQrRegistrationButton } from "@/components/game/game-qr-registration-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/store/ui-store";

const deleteAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

type GameCard = {
  _id: string;
  title: string;
  gameId: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  status: "draft" | "active" | "ended";
  updatedAt?: string;
};

function GameList({
  games,
  emptyMessage,
  variant,
  onDelete,
  deletingGameId,
}: {
  games: GameCard[];
  emptyMessage: string;
  variant: "active" | "past";
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
}) {
  if (games.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {games.map((game) => (
        <div
          key={game._id}
          className="surface-muted flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="body-lg">{game.title}</p>
              {variant === "past" ? (
                <Badge variant="outline" className="shrink-0">
                  Ended
                </Badge>
              ) : null}
            </div>
            <p className="caption">
              {game.openPlayType} | Courts: {game.courtCount} | Expected: {game.expectedPlayers}
              {variant === "past" && game.updatedAt ? (
                <>
                  {" "}
                  | Ended{" "}
                  <span suppressHydrationWarning>
                    {formatDistanceToNow(new Date(game.updatedAt), { addSuffix: true })}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {variant === "active" ? (
              <>
                <Link href={`/games/${game.gameId}`}>
                  <Button>Open Dashboard</Button>
                </Link>
                <Link href={`/games/${game.gameId}/spectate`}>
                  <Button variant="outline">
                    <Eye className="mr-2 h-4 w-4" />
                    Spectator View
                  </Button>
                </Link>
              </>
            ) : (
              <Link href={`/games/${game.gameId}`}>
                <Button variant="outline">View Dashboard</Button>
              </Link>
            )}
            <GameQrRegistrationButton gameId={game.gameId} gameTitle={game.title} />
            <Link href={`/leaderboard/${game.gameId}`}>
              <Button variant="outline">Leaderboard</Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete ${game.title}`}
              disabled={deletingGameId === game.gameId}
              onClick={() => onDelete(game)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HomeInner() {
  const queryClient = useQueryClient();
  const setCreateGameWizardOpen = useUiStore((state) => state.setCreateGameWizardOpen);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const response = await fetch("/api/games");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { games: GameCard[] };
    },
    refetchInterval: 5000,
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete game.");
    },
    onSettled: () => setDeletingGameId(null),
  });

  const handleDeleteGame = async (game: GameCard) => {
    const result = await Swal.fire({
      ...deleteAlertOptions,
      title: "Delete game?",
      text: `"${game.title}" and all queue, court, and match data will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    setDeletingGameId(game.gameId);
    deleteGameMutation.mutate(game.gameId);
  };

  const games = data?.games ?? [];
  const activeGames = games.filter((game) => game.status !== "ended");
  const pastGames = games.filter((game) => game.status === "ended");
  const leaderboardGameId = activeGames[0]?.gameId ?? pastGames[0]?.gameId;

  return (
    <main className="min-h-screen px-6 py-6 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <Card className="glass-panel">
          <CardContent className="flex flex-wrap gap-4 p-6">
            <Button size="lg" className="min-w-44" onClick={() => setCreateGameWizardOpen(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Create Pickleball Game
            </Button>
            {leaderboardGameId ? (
              <Link href={`/leaderboard/${leaderboardGameId}`}>
                <Button size="lg" variant="outline" className="min-w-44">
                  <Trophy className="mr-2 h-5 w-5" />
                  View Leaderboard
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="section-title">Games</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active" className="gap-4">
              <TabsList>
                <TabsTrigger value="active">
                  Active Games
                  {activeGames.length > 0 ? (
                    <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                      {activeGames.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past Games
                  {pastGames.length > 0 ? (
                    <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                      {pastGames.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                <GameList
                  games={activeGames}
                  variant="active"
                  emptyMessage="No active games. Create one to start queuing."
                  onDelete={handleDeleteGame}
                  deletingGameId={deletingGameId}
                />
              </TabsContent>
              <TabsContent value="past">
                <GameList
                  games={pastGames}
                  variant="past"
                  emptyMessage="No past games yet. Ended open play sessions will appear here."
                  onDelete={handleDeleteGame}
                  deletingGameId={deletingGameId}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
      <CreateGameWizard />
    </main>
  );
}

export default function Home() {
  return <HomeInner />;
}
