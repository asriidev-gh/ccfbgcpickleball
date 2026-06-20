"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
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

import { CreateDemoOpenPlayDialog } from "@/components/game/create-demo-open-play-dialog";
import { CreateGameWizard } from "@/components/game/create-game-wizard";
import { EditGameDialog, type EditGameDialogGame } from "@/components/game/edit-game-dialog";
import { WatchDemoButton } from "@/components/watch-demo-button";
import { GameExportButton } from "@/components/game/game-export-button";
import {
  GAME_LIST_DESKTOP_MEDIA,
  GameListViewToggle,
  loadGameListView,
  saveGameListView,
  type GameListViewMode,
} from "@/components/game/game-list-view-toggle";
import { GameListQrMode } from "@/components/game/game-list-qr-mode";
import { GameQrRegistrationButton } from "@/components/game/game-qr-registration-button";
import { GameQrRegistrationSlot } from "@/components/game/game-qr-registration-slot";
import { GameSpectatorShareButton } from "@/components/game/game-spectator-share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { prefetchOperatorDashboard } from "@/lib/fetch-operator-game";
import { useGamesList } from "@/hooks/use-games-list";
import { useUiStore } from "@/store/ui-store";
import {
  isDemoOpenPlayTitle,
  type DemoOpenPlayPlayerCount,
} from "@/lib/demo-open-play";
import { cn } from "@/lib/utils";

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

const gameListToolbarIconClass = "size-8 shrink-0 rounded-full";

function GameListIconToolbar({
  game,
  onEdit,
  onDelete,
  deletingGameId,
  includeQr = false,
  className,
}: {
  game: GameCard;
  onEdit: (game: GameCard) => void;
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
  includeQr?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "game-list-card-toolbar inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-background/90 p-1 shadow-sm",
        className,
      )}
      role="toolbar"
      aria-label={`Quick actions for ${game.title}`}
    >
      {includeQr ? (
        <SimpleTooltip label="Show QR code">
          <span>
            <GameQrRegistrationButton
              gameId={game.gameId}
              gameTitle={game.title}
              iconOnly
              className={gameListToolbarIconClass}
            />
          </span>
        </SimpleTooltip>
      ) : null}
      <GameSpectatorShareButton
        gameId={game.gameId}
        gameTitle={game.title}
        iconOnly
        className={gameListToolbarIconClass}
      />
      <GameExportButton
        gameId={game.gameId}
        gameTitle={game.title}
        iconOnly
        className={gameListToolbarIconClass}
      />
      <SimpleTooltip label="Edit Open Session">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 shrink-0 rounded-full"
          aria-label={`Edit ${game.title}`}
          onClick={() => onEdit(game)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
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
  hideToolbarOnMobile = false,
}: {
  game: GameCard;
  variant: "active" | "past";
  onEdit: (game: GameCard) => void;
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
  userType?: string | null;
  compact?: boolean;
  hideToolbarOnMobile?: boolean;
}) {
  const queryClient = useQueryClient();
  const isDemo = isDemoOpenPlayTitle(game.title);
  const dashboardHref = `/games/${game.gameId}`;
  const leaderboardHref = `/leaderboard/${game.gameId}`;
  const dashboardLabel = variant === "active" ? "Open Dashboard" : "View Dashboard";
  const dashboardShortLabel = variant === "active" ? "Dashboard" : "View";

  const warmDashboard = () => {
    if (variant === "active") {
      prefetchOperatorDashboard(queryClient, game.gameId);
    }
  };

  const dashboardButton = (
    <Link
      href={dashboardHref}
      className="min-w-0 flex-1"
      onMouseEnter={warmDashboard}
      onFocus={warmDashboard}
    >
      <Button
        variant={variant === "active" ? "default" : "outline"}
        size="sm"
        className="game-list-action-btn h-10 w-full gap-1.5 px-2 sm:px-3"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate sm:hidden">{dashboardShortLabel}</span>
        <span className="hidden truncate sm:inline">{dashboardLabel}</span>
      </Button>
    </Link>
  );

  const leaderboardButton = (
    <Link href={leaderboardHref} className="min-w-0 flex-1">
      <Button variant="outline" size="sm" className="game-list-action-btn h-10 w-full gap-1.5 px-2 sm:px-3">
        <Trophy className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Leaderboard</span>
      </Button>
    </Link>
  );

  const iconToolbar = (
    <GameListIconToolbar
      game={game}
      onEdit={onEdit}
      onDelete={onDelete}
      deletingGameId={deletingGameId}
    />
  );

  const toolbarPlacementClass = hideToolbarOnMobile ? "hidden md:flex" : "flex";

  if (compact) {
    return (
      <div className="game-list-actions game-list-actions--compact flex w-full flex-col gap-2.5">
        {isDemo ? <WatchDemoButton className="w-full" userType={userType ?? undefined} /> : null}
        <Link href={dashboardHref} className="w-full">
          <Button
            variant={variant === "active" ? "default" : "outline"}
            size="sm"
            className="game-list-action-btn h-10 w-full gap-1.5"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{dashboardLabel}</span>
          </Button>
        </Link>
        <div
          className={cn(
            "items-center gap-2",
            hideToolbarOnMobile
              ? "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto]"
              : "grid grid-cols-[minmax(0,1fr)_auto]",
          )}
        >
          {leaderboardButton}
          <div className={cn("justify-center", toolbarPlacementClass)}>{iconToolbar}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-list-actions w-full min-w-0 md:mx-auto md:max-w-[16rem]">
      {isDemo ? (
        <WatchDemoButton className="mb-0.5 w-full" userType={userType ?? undefined} />
      ) : null}
      <div className="game-list-actions__primary grid grid-cols-2 gap-2">
        {dashboardButton}
        {leaderboardButton}
      </div>
      <div className={cn("game-list-actions__toolbar mt-2 justify-center", toolbarPlacementClass)}>
        {iconToolbar}
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
            className="game-list-card relative flex h-full flex-col border-border/80 bg-card/80 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="game-list-mobile-toolbar absolute top-3 right-3 z-10 md:hidden">
              <GameListIconToolbar
                game={game}
                onEdit={onEdit}
                onDelete={onDelete}
                deletingGameId={deletingGameId}
                includeQr
              />
            </div>
            <CardHeader className="flex-1 gap-2 pb-3 pr-[11rem] md:pr-0">
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
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
                <div className="game-list-card-register hidden w-full min-w-0 justify-center md:flex">
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
                hideToolbarOnMobile
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
          className="game-list-row surface-muted relative grid grid-cols-1 overflow-hidden rounded-xl border border-border/50 md:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,3fr)] md:items-center md:gap-5 md:border-0 md:p-4 lg:gap-6"
        >
          <div className="game-list-mobile-toolbar absolute top-3 right-3 z-10 md:hidden">
            <GameListIconToolbar
              game={game}
              onEdit={onEdit}
              onDelete={onDelete}
              deletingGameId={deletingGameId}
              includeQr
            />
          </div>
          <section
            className="game-list-col-details min-w-0 px-4 pt-4 pr-[11rem] pb-3 md:p-0 md:pr-0"
            aria-label={`Details for ${game.title}`}
          >
            <GameListInfoGrouped game={game} variant={variant} />
          </section>
          <section
            className="game-list-col-actions flex min-w-0 flex-col justify-center border-t border-border/50 bg-muted/25 px-4 py-3 md:border-t-0 md:bg-transparent md:px-0 md:py-0"
            aria-label={`Actions for ${game.title}`}
          >
            <GameListActions
              game={game}
              variant={variant}
              onEdit={onEdit}
              onDelete={onDelete}
              deletingGameId={deletingGameId}
              userType={userType ?? undefined}
              hideToolbarOnMobile
            />
          </section>
          <section
            className="game-list-col-register hidden min-w-0 justify-center border-t border-border/50 px-4 py-3 md:flex md:justify-end md:border-t-0 md:px-0 md:py-0"
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
  const [listView, setListView] = useState<GameListViewMode>("list");
  const [viewReady, setViewReady] = useState(false);
  const [gamesTab, setGamesTab] = useState<"active" | "past">("active");
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(GAME_LIST_DESKTOP_MEDIA);
    const syncView = () => {
      setListView(loadGameListView());
      setViewReady(true);
    };
    syncView();

    const onViewportChange = () => {
      setListView(loadGameListView());
    };
    mq.addEventListener("change", onViewportChange);
    return () => mq.removeEventListener("change", onViewportChange);
  }, []);

  const displayView: GameListViewMode = viewReady ? listView : "list";

  const handleListViewChange = (view: GameListViewMode) => {
    setListView(view);
    setViewReady(true);
    saveGameListView(view);
  };

  const { data, refetch, isLoading } = useGamesList();

  const handleGamesTabChange = (value: string) => {
    const tab = value === "past" ? "past" : "active";
    setGamesTab(tab);
    void refetch();
  };

  const hasDemoOpenPlay = Boolean(data?.hasDemoOpenPlay);
  const canShowDemoOpenPlayButton = Boolean(data?.canCreateDemoOpenPlay);
  const showDemoCreateOption = !hasDemoOpenPlay && canShowDemoOpenPlayButton;
  const userType = data?.userType;

  useEffect(() => {
    if (!data?.games) return;
    for (const game of data.games.filter((item) => item.status !== "ended")) {
      prefetchOperatorDashboard(queryClient, game.gameId);
    }
  }, [data?.games, queryClient]);

  const generateTestGameMutation = useMutation({
    mutationFn: async ({
      courtCount,
      playerCount,
    }: {
      courtCount: number;
      playerCount: DemoOpenPlayPlayerCount;
    }) => {
      const response = await fetch("/api/games/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtCount, playerCount }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { message: string; game: { gameId: string; title: string } };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setDemoDialogOpen(false);
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

  const handleGenerateDemo = (params: {
    courtCount: number;
    playerCount: DemoOpenPlayPlayerCount;
  }) => {
    generateTestGameMutation.mutate(params);
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
    <>
      <Card className="glass-panel">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="section-title text-base font-medium text-muted-foreground">
              Open play sessions
            </CardTitle>
            {showDemoCreateOption ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={generateTestGameMutation.isPending}
                  render={
                    <Button size="lg" className="min-w-28">
                      {generateTestGameMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5" />
                          Create
                          <ChevronDown className="h-4 w-4 opacity-70" />
                        </>
                      )}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setCreateGameWizardOpen(true)}>
                    <Plus />
                    Real game
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDemoDialogOpen(true)}>
                    <FlaskConical />
                    Demo game
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="lg" className="min-w-28" onClick={() => setCreateGameWizardOpen(true)}>
                <Plus className="h-5 w-5" />
                Create
              </Button>
            )}
          </div>
          <div className="hidden flex-wrap gap-2 md:flex">
            <GameListViewToggle value={displayView} onChange={handleListViewChange} />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={gamesTab} onValueChange={handleGamesTabChange} className="gap-4">
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading games…
                  </div>
                ) : (
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
                )}
              </TabsContent>
              <TabsContent value="past">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading games…
                  </div>
                ) : (
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
                )}
              </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      <CreateGameWizard />
      <CreateDemoOpenPlayDialog
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
        isPending={generateTestGameMutation.isPending}
        onSubmit={handleGenerateDemo}
      />
      <EditGameDialog
        game={editingGame}
        open={Boolean(editingGame)}
        onOpenChange={(open) => {
          if (!open) setEditingGame(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["games"] })}
      />
    </>
  );
}
