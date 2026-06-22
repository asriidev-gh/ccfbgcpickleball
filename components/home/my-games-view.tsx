"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  CirclePlay,
  ClipboardList,
  Clock,
  Download,
  FlaskConical,
  Gauge,
  LayoutGrid,
  Loader2,
  LogIn,
  Pencil,
  QrCode,
  Plus,
  Share2,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { CreateDemoOpenPlayDialog } from "@/components/game/create-demo-open-play-dialog";
import { CreateGameWizard } from "@/components/game/create-game-wizard";
import { SwitchToCourtViewButton } from "@/components/game/switch-to-court-view-button";
import { DemoVideoDialog } from "@/components/demo-video-dialog";
import { EditGameDialog, type EditGameDialogGame } from "@/components/game/edit-game-dialog";
import { EditQuickGameDialog } from "@/components/game/edit-quick-game-dialog";
import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { GameSpectatorShareDialog } from "@/components/game/game-spectator-share-dialog";
import { WatchDemoButton } from "@/components/watch-demo-button";
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
import { GameExportButton } from "@/components/game/game-export-button";
import {
  fetchGameRegistrationStatus,
  promptIfRegistrationFull,
} from "@/components/game/registration-capacity-prompt";
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
import { getClientSpectatorShareUrl } from "@/lib/app-url";
import { useGamesList } from "@/hooks/use-games-list";
import { useUiStore } from "@/store/ui-store";
import {
  isDemoOpenPlayTitle,
  type DemoOpenPlayPlayerCount,
} from "@/lib/demo-open-play";
import { getGameRegistrationTypeLabel } from "@/lib/game-registration-type-label";
import { isAccountQuickGame } from "@/lib/local-game-id";
import { listLocalGameCards } from "@/lib/local-game-list";
import { mergeQuickGameListCards } from "@/lib/merge-quick-game-list";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import {
  deleteSavedQuickGame,
  ensureAccountQuickGameHydrated,
  type SavedQuickGameListItem,
} from "@/lib/quick-game-persistence-client";
import { removeQuickGameSession } from "@/lib/quick-game-store";
import { useSavedQuickGames, savedQuickGamesQueryKey } from "@/hooks/use-saved-quick-games";
import { useLocalGameStore } from "@/store/local-game-store";
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
  registrationMode?: "self" | "owner";
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  updatedAt?: string;
  isLocalGame?: boolean;
  isSavedQuickGame?: boolean;
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
  variant: "active" | "past" | "quick";
}) {
  return (
    <ul className="list-none space-y-0.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
      <GameMetaRow icon={Gauge}>{game.openPlayType}</GameMetaRow>
      <GameMetaRow icon={LayoutGrid}>Courts: {game.courtCount}</GameMetaRow>
      <GameMetaRow icon={Users}>
        {game.isLocalGame ? "Players" : "Expected"}: {game.expectedPlayers}
        {game.strictPlayerCount === true ? " (strict)" : ""}
      </GameMetaRow>
      {game.isLocalGame ? null : (
        <GameMetaRow icon={game.registrationMode === "owner" ? ClipboardList : QrCode}>
          Registration: {getGameRegistrationTypeLabel(game.registrationMode)}
        </GameMetaRow>
      )}
      {variant === "past" || game.status === "ended" ? (
        <GameMetaRow icon={Clock}>
          Ended
          {game.updatedAt ? (
            <>
              {" "}
              <span suppressHydrationWarning>
                {formatDistanceToNow(new Date(game.updatedAt), { addSuffix: true })}
              </span>
            </>
          ) : null}
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

function GameTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
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
  variant: "active" | "past" | "quick";
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
          {variant === "past" || game.status === "ended" ? (
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
        {game.isLocalGame ? "Players" : "Expected"}: {game.expectedPlayers}
        {game.strictPlayerCount === true ? " (strict)" : ""}
      </span>
      {game.isLocalGame ? null : (
        <>
          {game.registrationMode === "owner" ? (
            <ClipboardList
              className={cn(metaIconClass, "col-start-1 row-start-5 self-center")}
              aria-hidden
            />
          ) : (
            <QrCode
              className={cn(metaIconClass, "col-start-1 row-start-5 self-center")}
              aria-hidden
            />
          )}
          <span className="col-start-2 row-start-5 text-xs text-muted-foreground md:text-sm">
            Registration: {getGameRegistrationTypeLabel(game.registrationMode)}
          </span>
        </>
      )}
      {variant === "past" || game.status === "ended" ? (
        <>
          <Clock
            className={cn(metaIconClass, "col-start-1 row-start-6 self-center")}
            aria-hidden
          />
          <span className="col-start-2 row-start-6 text-xs text-muted-foreground md:text-sm">
            Ended
            {game.updatedAt ? (
              <>
                {" "}
                <span suppressHydrationWarning>
                  {formatDistanceToNow(new Date(game.updatedAt), { addSuffix: true })}
                </span>
              </>
            ) : null}
          </span>
        </>
      ) : null}
    </div>
  );
}

function parseExportFilename(header: string | null, gameTitle: string) {
  if (!header) return `${gameTitle.replace(/\s+/g, "-")}-registrations.xlsx`;
  const match = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return match?.[1]?.trim() ?? `${gameTitle.replace(/\s+/g, "-")}-registrations.xlsx`;
}

const gameListToolbarIconClass = "size-8 shrink-0 rounded-full";

function quickGameExportPath(gameId: string) {
  return `/api/quick-games/${encodeURIComponent(gameId)}/export`;
}

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
      {includeQr && !game.isLocalGame ? (
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
      {game.isLocalGame ? (
        <>
          <GameExportButton
            gameId={game.gameId}
            gameTitle={game.title}
            exportPath={quickGameExportPath(game.gameId)}
            successMessage="Player list downloaded."
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
        </>
      ) : (
        <>
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
        </>
      )}
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

function GameListActionsMenu({
  game,
  variant,
  onEdit,
  onDelete,
  deletingGameId,
  userType,
}: {
  game: GameCard;
  variant: "active" | "past" | "quick";
  onEdit: (game: GameCard) => void;
  onDelete: (game: GameCard) => void;
  deletingGameId: string | null;
  userType?: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDemo = isDemoOpenPlayTitle(game.title);
  const dashboardHref = `/games/${game.gameId}`;
  const isEnded = game.status === "ended";
  const dashboardLabel = "Enter Game";
  const DashboardIcon = LogIn;

  const spectatorUrl = getClientSpectatorShareUrl(game.gameId);

  const [shareOpen, setShareOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [registerUrl, setRegisterUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isSpectatorQr, setIsSpectatorQr] = useState(false);

  const warmDashboard = async () => {
    if (!isEnded) {
      if (game.isLocalGame) {
        try {
          await ensureAccountQuickGameHydrated(game.gameId);
        } catch {
          // Fall back to whatever is already in session storage.
        }
        seedLocalGameOperatorCache(queryClient, game.gameId);
      } else {
        prefetchOperatorDashboard(queryClient, game.gameId);
      }
    }
  };

  const openQrDialog = async () => {
    setQrLoading(true);
    try {
      const status = await fetchGameRegistrationStatus(game.gameId);
      const spectatorQr = status.allowQrRegistration === false;
      setIsSpectatorQr(spectatorQr);

      const canProceed = await promptIfRegistrationFull(game.gameId);
      if (!canProceed) return;

      if (registerUrl && qrCodeDataUrl) {
        setQrOpen(true);
        return;
      }

      const response = await fetch(`/api/games/${game.gameId}/qr`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      setRegisterUrl(payload.registerUrl);
      setQrCodeDataUrl(payload.publicQrCodeDataUrl);
      setIsSpectatorQr(spectatorQr || payload.registerUrl?.includes("/spectate"));
      setQrOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load registration QR.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const response = await fetch(
        game.isLocalGame ? quickGameExportPath(game.gameId) : `/api/games/${game.gameId}/export`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Export failed.");
      }

      const blob = await response.blob();
      const filename = parseExportFilename(response.headers.get("Content-Disposition"), game.title);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(game.isLocalGame ? "Player list downloaded." : "Registration export downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <>
      <div className="game-list-actions game-list-actions--menu w-full min-w-0 lg:mx-auto lg:max-w-[16rem]">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={deletingGameId === game.gameId}
            className="w-full"
            render={
              <Button
                type="button"
                variant={isEnded ? "outline" : "default"}
                size="sm"
                className="game-list-action-btn h-11 w-full gap-1.5 px-4 lg:h-10"
              >
                Actions
                <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent
            align="center"
            className="game-list-actions-menu__content w-(--anchor-width) min-w-[12rem] sm:min-w-56"
          >
            <DropdownMenuItem
              className="game-list-actions-menu__item"
              onClick={() => {
                warmDashboard();
                router.push(dashboardHref);
              }}
            >
              <DashboardIcon aria-hidden />
              {dashboardLabel}
            </DropdownMenuItem>
            {game.isLocalGame ? (
              <>
                <DropdownMenuItem
                  className="game-list-actions-menu__item"
                  disabled={exportLoading}
                  onClick={() => void handleExport()}
                >
                  {exportLoading ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Download aria-hidden />
                  )}
                  Download player list
                </DropdownMenuItem>
                <DropdownMenuItem className="game-list-actions-menu__item" onClick={() => onEdit(game)}>
                  <Pencil aria-hidden />
                  Edit open session
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  className="game-list-actions-menu__item md:hidden"
                  disabled={qrLoading}
                  onClick={() => void openQrDialog()}
                >
                  {qrLoading ? <Loader2 className="animate-spin" aria-hidden /> : <QrCode aria-hidden />}
                  QR registration
                </DropdownMenuItem>
                <DropdownMenuItem className="game-list-actions-menu__item" onClick={() => setShareOpen(true)}>
                  <Share2 aria-hidden />
                  Share spectator view
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="game-list-actions-menu__item"
                  disabled={exportLoading}
                  onClick={() => void handleExport()}
                >
                  {exportLoading ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Download aria-hidden />
                  )}
                  Download player list
                </DropdownMenuItem>
              </>
            )}
            {isDemo ? (
              <DropdownMenuItem className="game-list-actions-menu__item" onClick={() => setDemoOpen(true)}>
                <CirclePlay aria-hidden />
                Watch demo
              </DropdownMenuItem>
            ) : null}
            {!game.isLocalGame ? (
              <DropdownMenuItem className="game-list-actions-menu__item" onClick={() => onEdit(game)}>
                <Pencil aria-hidden />
                Edit open session
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="game-list-actions-menu__item"
              variant="destructive"
              disabled={deletingGameId === game.gameId}
              onClick={() => onDelete(game)}
            >
              <Trash2 aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GameSpectatorShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        gameTitle={game.title}
        spectatorUrl={spectatorUrl}
      />
      {!game.isLocalGame && registerUrl && qrCodeDataUrl ? (
        <GameQrDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          gameTitle={game.title}
          registerUrl={registerUrl}
          qrCodeDataUrl={qrCodeDataUrl}
          mode={isSpectatorQr ? "spectator" : "registration"}
        />
      ) : null}
      {isDemo ? (
        <DemoVideoDialog open={demoOpen} onOpenChange={setDemoOpen} userType={userType ?? undefined} />
      ) : null}
    </>
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
  variant: "active" | "past" | "quick";
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
  const isEnded = game.status === "ended";
  const dashboardLabel = "Enter Game";
  const dashboardShortLabel = "Enter";
  const DashboardIcon = LogIn;

  const warmDashboard = async () => {
    if (!isEnded) {
      if (game.isLocalGame) {
        try {
          await ensureAccountQuickGameHydrated(game.gameId);
        } catch {
          // Fall back to whatever is already in session storage.
        }
        seedLocalGameOperatorCache(queryClient, game.gameId);
      } else {
        prefetchOperatorDashboard(queryClient, game.gameId);
      }
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
        variant={isEnded ? "outline" : "default"}
        size="sm"
        className="game-list-action-btn h-10 w-full gap-1.5 px-2 sm:px-3"
      >
        <DashboardIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate sm:hidden">{dashboardShortLabel}</span>
        <span className="hidden truncate sm:inline">{dashboardLabel}</span>
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
        <div className="flex w-full items-stretch gap-2">
          <Link
            href={dashboardHref}
            className="min-w-0 flex-1"
            onMouseEnter={warmDashboard}
            onFocus={warmDashboard}
          >
            <Button
              variant={isEnded ? "outline" : "default"}
              size="sm"
              className="game-list-action-btn h-10 w-full gap-1.5 px-2 sm:px-3"
            >
              <DashboardIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate sm:hidden">{dashboardShortLabel}</span>
              <span className="hidden truncate sm:inline">{dashboardLabel}</span>
            </Button>
          </Link>
          <div className={cn("shrink-0 items-center justify-center", toolbarPlacementClass)}>
            {iconToolbar}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-list-actions w-full min-w-0 md:mx-auto md:max-w-[16rem]">
      {isDemo ? (
        <WatchDemoButton className="mb-0.5 w-full" userType={userType ?? undefined} />
      ) : null}
      <div className="game-list-actions__primary">{dashboardButton}</div>
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
  variant: "active" | "past" | "quick";
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
    if (variant === "quick" || games.every((game) => game.isLocalGame)) {
      return (
        <p className="text-muted-foreground">
          Quick games don&apos;t use registration QR codes. Switch to list or card view.
        </p>
      );
    }
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
                includeQr={!game.isLocalGame}
              />
            </div>
            <CardHeader className="flex-1 gap-2 pb-3 pr-[11rem] md:pr-0">
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
                <div className="game-list-card-details min-w-0 space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <CardTitle className="min-w-0 flex-1 text-lg font-semibold md:text-xl">
                      <GameTitle title={game.title} />
                    </CardTitle>
                    {variant === "past" || game.status === "ended" ? (
                      <Badge variant="outline" className="shrink-0">
                        Ended
                      </Badge>
                    ) : null}
                  </div>
                  <GameMeta game={game} variant={variant} />
                </div>
                <div className="game-list-card-register hidden w-full min-w-0 justify-center md:flex">
                  {game.isLocalGame ? null : (
                    <GameQrRegistrationSlot
                      key={`${game.gameId}-${game.updatedAt ?? ""}-${game.status}-${game.allowQrRegistration ?? true}`}
                      gameId={game.gameId}
                      gameTitle={game.title}
                      compact
                      spectatorOnly={game.status === "ended"}
                    />
                  )}
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
          className={cn(
            "game-list-row surface-muted grid grid-cols-1 overflow-hidden rounded-xl border border-border/50 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,3fr)] lg:items-center lg:gap-6 lg:border-0 lg:p-4",
            games.every((item) => item.isLocalGame) &&
              "lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]",
          )}
        >
          <section
            className="game-list-col-details min-w-0 px-4 pt-4 pb-3 lg:p-0"
            aria-label={`Details for ${game.title}`}
          >
            <GameListInfoGrouped game={game} variant={variant} />
          </section>
          <section
            className="game-list-col-actions flex min-w-0 flex-col justify-center border-t border-border/50 bg-muted/25 px-4 py-3.5 sm:px-5 sm:py-4 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0"
            aria-label={`Actions for ${game.title}`}
          >
            <GameListActionsMenu
              game={game}
              variant={variant}
              onEdit={onEdit}
              onDelete={onDelete}
              deletingGameId={deletingGameId}
              userType={userType ?? undefined}
            />
          </section>
          <section
            className={cn(
              "game-list-col-register hidden min-w-0 justify-center border-t border-border/50 px-4 py-3 sm:px-5 sm:py-4 md:flex lg:justify-end lg:border-t-0 lg:px-0 lg:py-0",
              games.some((game) => !game.isLocalGame) ? "" : "lg:hidden",
            )}
            aria-label="Registration"
          >
            {game.isLocalGame ? null : (
              <GameQrRegistrationSlot
                key={`${game.gameId}-${game.updatedAt ?? ""}-${game.status}-${game.allowQrRegistration ?? true}`}
                gameId={game.gameId}
                gameTitle={game.title}
                compact
                spectatorOnly={game.status === "ended"}
              />
            )}
          </section>
        </div>
      ))}
    </div>
  );
}

export function MyGamesView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setCreateGameWizardOpen = useUiStore((state) => state.setCreateGameWizardOpen);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<EditGameDialogGame | null>(null);
  const [editingQuickGame, setEditingQuickGame] = useState<GameCard | null>(null);
  const [listView, setListView] = useState<GameListViewMode>("list");
  const [viewReady, setViewReady] = useState(false);
  const [gamesTab, setGamesTab] = useState<"active" | "past" | "quick">("active");
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
  const listViewForTab: GameListViewMode =
    gamesTab === "quick" && displayView === "qr" ? "list" : displayView;

  const handleListViewChange = (view: GameListViewMode) => {
    setListView(view);
    setViewReady(true);
    saveGameListView(view);
  };

  const { data, refetch, isLoading } = useGamesList();
  const { data: savedQuickGames = [] } = useSavedQuickGames();

  const localSessionsRecord = useLocalGameStore((state) => state.sessions);

  const handleGamesTabChange = (value: string) => {
    const tab = value === "past" ? "past" : value === "quick" ? "quick" : "active";
    setGamesTab(tab);
    if (tab === "quick" && listView === "qr") {
      setListView("list");
      setViewReady(true);
      saveGameListView("list");
    }
    if (tab === "quick") {
      void queryClient.invalidateQueries({ queryKey: ["saved-quick-games"] });
    }
    if (tab !== "quick") void refetch();
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

  const quickGames = useMemo(
    () => mergeQuickGameListCards(listLocalGameCards(localSessionsRecord), savedQuickGames),
    [localSessionsRecord, savedQuickGames],
  );
  const showQuickGamesTab = quickGames.length > 0;

  useEffect(() => {
    if (!showQuickGamesTab && gamesTab === "quick") {
      setGamesTab("active");
    }
  }, [gamesTab, showQuickGamesTab]);

  useEffect(() => {
    for (const game of quickGames.filter((item) => item.status !== "ended")) {
      seedLocalGameOperatorCache(queryClient, game.gameId);
    }
  }, [quickGames, queryClient]);

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

  const handleEditGame = (game: GameCard) => {
    if (game.isLocalGame) {
      setEditingQuickGame(game);
      return;
    }
    setEditingGame(game);
  };

  const handleDeleteGame = async (game: GameCard) => {
    const deleteMessage = game.isLocalGame
      ? `"${game.title}" will be removed from this browser. Queue, court, and match data for this quick game cannot be recovered.`
      : `"${game.title}" and all queue, court, and match data will be permanently removed.`;

    const result = await Swal.fire({
      ...deleteAlertOptions,
      title: game.isLocalGame ? "Remove quick game?" : "Delete game?",
      text: deleteMessage,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: game.isLocalGame ? "Yes, remove" : "Yes, delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    setDeletingGameId(game.gameId);
    if (game.isLocalGame) {
      removeQuickGameSession(game.gameId);

      const shouldTryDeleteSavedCopy =
        game.isSavedQuickGame ||
        savedQuickGames.some((savedGame) => savedGame.gameId === game.gameId) ||
        isAccountQuickGame(game.gameId);

      if (shouldTryDeleteSavedCopy) {
        try {
          await deleteSavedQuickGame(game.gameId);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete saved quick game.";
          if (!/not found/i.test(message)) {
            toast.error(message);
            setDeletingGameId(null);
            return;
          }
        }
        queryClient.setQueryData<SavedQuickGameListItem[]>(savedQuickGamesQueryKey(), (current) =>
          (current ?? []).filter((savedGame) => savedGame.gameId !== game.gameId),
        );
      }

      toast.success("Quick game removed.");
      setDeletingGameId(null);
      void queryClient.invalidateQueries({ queryKey: savedQuickGamesQueryKey() });
      return;
    }
    deleteGameMutation.mutate(game.gameId);
  };

  const games = data?.games ?? [];
  const activeGames = games.filter((game) => game.status !== "ended");
  const pastGames = games.filter((game) => game.status === "ended");
  const activeQuickGames = quickGames.filter((game) => game.status !== "ended");
  const showCourtsView = activeGames.length + activeQuickGames.length >= 2;

  useEffect(() => {
    if (showCourtsView) {
      router.prefetch("/my-games/courts-view");
    }
  }, [showCourtsView, router]);

  return (
    <>
      <Card className="glass-panel">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <GameListViewToggle
              value={listViewForTab}
              onChange={handleListViewChange}
              hideQrMode={gamesTab === "quick"}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {showCourtsView ? <SwitchToCourtViewButton /> : null}
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
                {showQuickGamesTab ? (
                <TabsTrigger value="quick">
                  Quick Games (live queue off)
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {quickGames.length}
                  </Badge>
                </TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="active">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                    Loading games…
                  </div>
                ) : (
                  <GameList
                    key={`active-${listViewForTab}`}
                    games={activeGames}
                    variant="active"
                    view={listViewForTab}
                    emptyMessage="No active games. Create one to start queuing."
                    onEdit={handleEditGame}
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
                    key={`past-${listViewForTab}`}
                    games={pastGames}
                    variant="past"
                    view={listViewForTab}
                    emptyMessage="No past games yet. Ended open play sessions will appear here."
                    onEdit={handleEditGame}
                    onDelete={handleDeleteGame}
                    deletingGameId={deletingGameId}
                    userType={userType}
                  />
                )}
              </TabsContent>
              {showQuickGamesTab ? (
              <TabsContent value="quick">
                <GameList
                  key={`quick-${listViewForTab}`}
                  games={quickGames}
                  variant="quick"
                  view={listViewForTab}
                  emptyMessage="No quick games yet. Create one with live queue off in the game wizard."
                  onEdit={handleEditGame}
                  onDelete={handleDeleteGame}
                  deletingGameId={deletingGameId}
                  userType={userType}
                />
              </TabsContent>
              ) : null}
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
      <EditQuickGameDialog
        gameId={editingQuickGame?.gameId ?? null}
        title={editingQuickGame?.title ?? ""}
        open={Boolean(editingQuickGame)}
        onOpenChange={(open) => {
          if (!open) setEditingQuickGame(null);
        }}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["saved-quick-games"] });
        }}
      />
    </>
  );
}
