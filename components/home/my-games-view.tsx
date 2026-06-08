"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { CreateGameWizard } from "@/components/game/create-game-wizard";
import { EditGameDialog, type EditGameDialogGame } from "@/components/game/edit-game-dialog";
import { WatchDemoButton } from "@/components/watch-demo-button";
import { GameExportButton } from "@/components/game/game-export-button";
import {
  GAME_LIST_DESKTOP_MEDIA,
  GAME_LIST_VIEW_STORAGE_KEY,
  GameListViewToggle,
  defaultGameListView,
  loadGameListView,
  saveGameListView,
  type GameListViewMode,
} from "@/components/game/game-list-view-toggle";
import { GameListQrMode } from "@/components/game/game-list-qr-mode";
import { GameQrRegistrationButton } from "@/components/game/game-qr-registration-button";
import { GameQrRegistrationSlot } from "@/components/game/game-qr-registration-slot";
import { HomeMobileNav } from "@/components/home-mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { useUiStore } from "@/store/ui-store";
import { isDemoOpenPlayTitle } from "@/lib/demo-open-play";
import { cn } from "@/lib/utils";

const deleteAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

const confirmAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#64748b",
};

type GameCard = {
  _id: string;
  title: string;
  gameId: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount?: boolean;
  allowQrRegistration?: boolean;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  updatedAt?: string;
};

function GameMetaRow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75 md:h-4 md:w-4"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

function GameMeta({
  game,
  variant,
}: {
  game: GameCard;
  variant: "active" | "past";
}) {
  return (
    <ul className="list-none space-y-0.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
      <GameMetaRow icon={Gauge}>{game.openPlayType}</GameMetaRow>
      <GameMetaRow icon={LayoutGrid}>Courts: {game.courtCount}</GameMetaRow>
      <GameMetaRow icon={Users}>
        Expected: {game.expectedPlayers}
        {game.strictPlayerCount === true ? " (strict)" : ""}
      </GameMetaRow>
      {variant === "past" && game.updatedAt ? (
        <GameMetaRow icon={Clock}>
          Ended{" "}
          <span suppressHydrationWarning>
            {formatDistanceToNow(new Date(game.updatedAt), { addSuffix: true })}
          </span>
        </GameMetaRow>
      ) : null}
    </ul>
  );
}

function DemoOnlyBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 rounded-full border-amber-500/40 bg-amber-500/10 px-2 py-0 text-[0.625rem] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200"
    >
      Demo only
    </Badge>
  );
}

function GameTitle({ title, className }: { title: string; className?: string }) {
  const isDemo = isDemoOpenPlayTitle(title);

  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      <CalendarDays
        className="mt-0.5 h-5 w-5 shrink-0 text-primary/70 md:h-5 md:w-5"
        aria-hidden
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 leading-snug">{title}</span>
        {isDemo ? <DemoOnlyBadge /> : null}
      </div>
    </div>
  );
}

const metaIconClass = "h-3.5 w-3.5 shrink-0 text-muted-foreground/75 md:h-4 md:w-4";

function GameListInfoGrouped({
  game,
  variant,
}: {
  game: GameCard;
  variant: "active" | "past";
}) {
  return (
    <div className="game-list-info-grouped grid min-w-0 grid-cols-[1.25rem_1fr] gap-x-2.5 gap-y-1">
      <CalendarDays
        className={cn(metaIconClass, "col-start-1 row-start-1 mt-0.5 text-primary/70")}
        aria-hidden
      />
      <div className="col-start-2 row-start-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold leading-snug md:text-xl">{game.title}</span>
          {isDemoOpenPlayTitle(game.title) ? <DemoOnlyBadge /> : null}
          {variant === "past" ? (
            <Badge variant="outline" className="shrink-0">
              Ended
            </Badge>
          ) : null}
        </div>
      </div>
      <Gauge className={cn(metaIconClass, "col-start-1 row-start-2 self-center")} aria-hidden />
      <span className="col-start-2 row-start-2 text-xs text-muted-foreground md:text-sm">
        {game.openPlayType}
      </span>
      <LayoutGrid
        className={cn(metaIconClass, "col-start-1 row-start-3 self-center")}
        aria-hidden
      />
      <span className="col-start-2 row-start-3 text-xs text-muted-foreground md:text-sm">
        Courts: {game.courtCount}
      </span>
      <Users className={cn(metaIconClass, "col-start-1 row-start-4 self-center")} aria-hidden />
      <span className="col-start-2 row-start-4 text-xs text-muted-foreground md:text-sm">
        Expected: {game.expectedPlayers}
        {game.strictPlayerCount === true ? " (strict)" : ""}
      </span>
      {variant === "past" && game.updatedAt ? (
        <>
          <Clock
            className={cn(metaIconClass, "col-start-1 row-start-5 self-center")}
            aria-hidden
          />
          <span className="col-start-2 row-start-5 text-xs text-muted-foreground md:text-sm">
            Ended{" "}
            <span suppressHydrationWarning>
              {formatDistanceToNow(new Date(game.updatedAt), { addSuffix: true })}
            </span>
          </span>
        </>
      ) : null}
    </div>
  );
}

function GameListIconToolbar({
  game,
  onEdit,
  onDelete,
  deletingGameId,
  includeQr = false,
}: {
  game: GameCard;
  onEdit: (game: GameCard) => void;
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
  includeQr?: boolean;
}) {
  return (
    <div
      className="game-list-card-toolbar inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      role="toolbar"
      aria-label={`Quick actions for ${game.title}`}
    >
      {includeQr ? (
        <span className="md:max-[1366px]:hidden">
          <GameQrRegistrationButton gameId={game.gameId} gameTitle={game.title} iconOnly />
        </span>
      ) : null}
      <GameExportButton gameId={game.gameId} gameTitle={game.title} iconOnly />
      <SimpleTooltip label="Edit Open Session">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={`Edit ${game.title}`}
          onClick={() => onEdit(game)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${game.title}`}
        disabled={deletingGameId === game.gameId}
        onClick={() => onDelete(game)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function GameListActions({
  game,
  variant,
  onEdit,
  onDelete,
  deletingGameId,
  userType,
  compact = false,
}: {
  game: GameCard;
  variant: "active" | "past";
  onEdit: (game: GameCard) => void;
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
  userType?: string | null;
  compact?: boolean;
}) {
  const isDemo = isDemoOpenPlayTitle(game.title);

  if (compact) {
    return (
      <div className="flex w-full flex-col gap-2.5">
        {isDemo ? <WatchDemoButton className="w-full" userType={userType ?? undefined} /> : null}
        {variant === "active" ? (
          <Link href={`/games/${game.gameId}`} className="mb-2 w-full">
            <Button className="w-full">
              <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Open Dashboard
            </Button>
          </Link>
        ) : (
          <Link href={`/games/${game.gameId}`} className="mb-2 w-full">
            <Button variant="outline" className="w-full">
              <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              View Dashboard
            </Button>
          </Link>
        )}
        <div className="flex items-stretch gap-2">
          <Link href={`/leaderboard/${game.gameId}`} className="min-w-0 flex-1">
            <Button variant="outline" className="w-full">
              <Trophy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Leaderboard
            </Button>
          </Link>
          <GameListIconToolbar
            game={game}
            onEdit={onEdit}
            onDelete={onDelete}
            deletingGameId={deletingGameId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[17rem] flex-col items-center gap-2">
      {isDemo ? <WatchDemoButton className="w-full" userType={userType ?? undefined} /> : null}
      {variant === "active" ? (
        <Link href={`/games/${game.gameId}`} className="w-full">
          <Button className="w-full">
            <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Open Dashboard
          </Button>
        </Link>
      ) : (
        <Link href={`/games/${game.gameId}`} className="w-full">
          <Button variant="outline" className="w-full">
            <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            View Dashboard
          </Button>
        </Link>
      )}
      <div className="flex items-stretch gap-2">
        <Link href={`/leaderboard/${game.gameId}`} className="min-w-0 flex-1">
          <Button variant="outline" className="w-full">
            <Trophy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Leaderboard
          </Button>
        </Link>
        <GameListIconToolbar
          game={game}
          onEdit={onEdit}
          onDelete={onDelete}
          deletingGameId={deletingGameId}
        />
      </div>
    </div>
  );
}

function GameList({
  games,
  emptyMessage,
  variant,
  view,
  onEdit,
  onDelete,
  deletingGameId,
  userType,
}: {
  games: GameCard[];
  emptyMessage: string;
  variant: "active" | "past";
  view: GameListViewMode;
  onEdit: (game: GameCard) => void;
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
  userType?: string | null;
}) {
  if (games.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  if (view === "qr") {
    return <GameListQrMode games={games} emptyMessage={emptyMessage} />;
  }

  if (view === "cards") {
    return (
      <div className="game-list-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <Card
            key={game._id}
            className="game-list-card flex h-full flex-col border-border/80 bg-card/80 shadow-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="flex-1 gap-2 pb-3">
              <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,3fr)] items-start gap-3">
                <div className="game-list-card-details min-w-0 space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <CardTitle className="min-w-0 flex-1 text-lg font-semibold md:text-xl">
                      <GameTitle title={game.title} />
                    </CardTitle>
                    {variant === "past" ? (
                      <Badge variant="outline" className="shrink-0">
                        Ended
                      </Badge>
                    ) : null}
                  </div>
                  <GameMeta game={game} variant={variant} />
                </div>
                <div className="game-list-card-register flex w-full min-w-0 justify-center">
                  <GameQrRegistrationSlot
                    key={`${game.gameId}-${game.updatedAt ?? ""}-${game.status}-${game.allowQrRegistration ?? true}`}
                    gameId={game.gameId}
                    gameTitle={game.title}
                    compact
                    spectatorOnly={game.status === "ended"}
                  />
                </div>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto border-t border-border/60 bg-muted/20 px-4 py-3">
              <GameListActions
                game={game}
                variant={variant}
                onEdit={onEdit}
                onDelete={onDelete}
                deletingGameId={deletingGameId}
                userType={userType ?? undefined}
                compact
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="game-list-rows space-y-3">
      {games.map((game) => (
        <div
          key={game._id}
          className="game-list-row surface-muted grid grid-cols-1 items-center gap-4 rounded-xl p-4 md:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,3fr)] md:gap-5 lg:gap-6"
        >
          <section className="game-list-col-details min-w-0" aria-label={`Details for ${game.title}`}>
            <GameListInfoGrouped game={game} variant={variant} />
          </section>
          <section
            className="game-list-col-actions flex flex-col items-center justify-center"
            aria-label={`Actions for ${game.title}`}
          >
            <GameListActions
              game={game}
              variant={variant}
              onEdit={onEdit}
              onDelete={onDelete}
              deletingGameId={deletingGameId}
              userType={userType ?? undefined}
            />
          </section>
          <section
            className="game-list-col-register flex min-w-0 justify-center md:justify-end"
            aria-label={`Registration for ${game.title}`}
          >
            <GameQrRegistrationSlot
              key={`${game.gameId}-${game.updatedAt ?? ""}-${game.status}-${game.allowQrRegistration ?? true}`}
              gameId={game.gameId}
              gameTitle={game.title}
              compact
              spectatorOnly={game.status === "ended"}
            />
          </section>
        </div>
      ))}
    </div>
  );
}

export function MyGamesView() {
  const queryClient = useQueryClient();
  const setCreateGameWizardOpen = useUiStore((state) => state.setCreateGameWizardOpen);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<EditGameDialogGame | null>(null);
  const [listView, setListView] = useState<GameListViewMode>("cards");
  const [viewReady, setViewReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(GAME_LIST_DESKTOP_MEDIA);
    const syncView = () => {
      setListView(loadGameListView());
      setViewReady(true);
    };
    syncView();

    const onViewportChange = () => {
      if (!localStorage.getItem(GAME_LIST_VIEW_STORAGE_KEY)) {
        setListView(defaultGameListView());
      }
    };
    mq.addEventListener("change", onViewportChange);
    return () => mq.removeEventListener("change", onViewportChange);
  }, []);

  const displayView: GameListViewMode = viewReady ? listView : "cards";

  const handleListViewChange = (view: GameListViewMode) => {
    setListView(view);
    setViewReady(true);
    saveGameListView(view);
  };

  const { data } = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const response = await fetch("/api/games");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { games: GameCard[]; hasDemoOpenPlay: boolean; userType?: string };
    },
    refetchInterval: 5000,
  });

  const hasDemoOpenPlay = Boolean(data?.hasDemoOpenPlay);
  const userType = data?.userType;

  const generateTestGameMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/games/generate-test", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { message: string; game: { gameId: string; title: string } };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to generate test game.");
    },
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

  const handleGenerateDemo = async () => {
    const result = await Swal.fire({
      ...confirmAlertOptions,
      title: "Create Demo Open Play?",
      text: "This open play is for demo purposes only and it will generate 18 players and 2 courts only.",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    generateTestGameMutation.mutate();
  };

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

  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <Card className="glass-panel">
          <CardContent className="flex flex-wrap gap-4 p-6">
            <Button size="lg" className="min-w-44" onClick={() => setCreateGameWizardOpen(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Create Open Play Session
            </Button>
            {!hasDemoOpenPlay ? (
              <Button
                size="lg"
                variant="outline"
                className="min-w-44"
                disabled={generateTestGameMutation.isPending}
                onClick={handleGenerateDemo}
              >
                {generateTestGameMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <FlaskConical className="mr-2 h-5 w-5" />
                    Create Demo Open Play
                  </>
                )}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="section-title">My Games</CardTitle>
            <GameListViewToggle value={displayView} onChange={handleListViewChange} />
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
                  key={`active-${displayView}`}
                  games={activeGames}
                  variant="active"
                  view={displayView}
                  emptyMessage="No active games. Create one to start queuing."
                  onEdit={setEditingGame}
                  onDelete={handleDeleteGame}
                  deletingGameId={deletingGameId}
                  userType={userType}
                />
              </TabsContent>
              <TabsContent value="past">
                <GameList
                  key={`past-${displayView}`}
                  games={pastGames}
                  variant="past"
                  view={displayView}
                  emptyMessage="No past games yet. Ended open play sessions will appear here."
                  onEdit={setEditingGame}
                  onDelete={handleDeleteGame}
                  deletingGameId={deletingGameId}
                  userType={userType}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
      <CreateGameWizard />
      <EditGameDialog
        game={editingGame}
        open={Boolean(editingGame)}
        onOpenChange={(open) => {
          if (!open) setEditingGame(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["games"] })}
      />
      <HomeMobileNav onCreateGame={() => setCreateGameWizardOpen(true)} />
    </main>
  );
}
