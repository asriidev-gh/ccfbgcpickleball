"use client";

import { House, Loader2, LogOut, QrCode, Trophy } from "lucide-react";
import { usePathname } from "next/navigation";

import { GameSessionActionsMenu } from "@/components/game/game-session-actions-menu";
import { buildSpectatorLeaderboardHref } from "@/lib/leaderboard-navigation";
import { GameCheckoutNotificationBell } from "@/components/game/spectator-notification-bell";
import { MobileBottomNavButton, MobileBottomNavShell } from "@/components/mobile-bottom-nav";

type GameDashboardMobileNavProps = {
  gameId: string;
  isQuickGameSession?: boolean;
  homeHref?: string;
  homeLabel?: string;
  homeIcon?: "home" | "exit";
  showQr: boolean;
  qrLoading: boolean;
  onQrClick: () => void;
  showDatabaseCheckIn: boolean;
  onDatabaseCheckInClick: () => void;
  showAddPlayer?: boolean;
  onAddPlayerClick?: () => void;
  showResetOpenPlay: boolean;
  resetOpenPlayPending: boolean;
  onResetOpenPlay: () => void;
  showEndOpenPlay: boolean;
  endOpenPlayPending: boolean;
  onEndOpenPlay: () => void;
};

export function GameDashboardMobileNav({
  gameId,
  isQuickGameSession = false,
  homeHref = "/",
  homeLabel = "Home",
  homeIcon = "home",
  showQr,
  qrLoading,
  onQrClick,
  showDatabaseCheckIn,
  onDatabaseCheckInClick,
  showAddPlayer = false,
  onAddPlayerClick,
  showResetOpenPlay,
  resetOpenPlayPending,
  onResetOpenPlay,
  showEndOpenPlay,
  endOpenPlayPending,
  onEndOpenPlay,
}: GameDashboardMobileNavProps) {
  const pathname = usePathname();
  const leaderboardHref = buildSpectatorLeaderboardHref(gameId);
  const isLeaderboard = pathname === `/leaderboard/${gameId}`;
  const notificationBell = (
    <GameCheckoutNotificationBell gameId={gameId} variant="mobileNav" iconOnly />
  );
  const homeButton = (
    <MobileBottomNavButton
      href={homeHref}
      label={homeLabel}
      icon={
        homeIcon === "exit" ? (
          <LogOut className="h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <House className="h-5 w-5 shrink-0" aria-hidden />
        )
      }
    />
  );

  return (
    <MobileBottomNavShell ariaLabel="Game actions">
      {homeButton}
      <MobileBottomNavButton
        href={leaderboardHref}
        label="Leaderboard"
        active={isLeaderboard}
        icon={<Trophy className="h-5 w-5 shrink-0" aria-hidden />}
      />
      {showQr ? (
        <MobileBottomNavButton
          label={qrLoading ? "Checking…" : "QR Registration"}
          disabled={qrLoading}
          onClick={onQrClick}
          icon={
            qrLoading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <QrCode className="h-5 w-5 shrink-0" aria-hidden />
            )
          }
        />
      ) : null}
      <GameSessionActionsMenu
        mobileNav
        showDatabaseCheckIn={showDatabaseCheckIn}
        onDatabaseCheckIn={onDatabaseCheckInClick}
        showAddPlayer={showAddPlayer}
        onAddPlayer={onAddPlayerClick}
        showResetOpenPlay={showResetOpenPlay}
        resetOpenPlayPending={resetOpenPlayPending}
        onResetOpenPlay={onResetOpenPlay}
        showEndOpenPlay={showEndOpenPlay}
        endOpenPlayPending={endOpenPlayPending}
        onEndOpenPlay={onEndOpenPlay}
      />
      {!isQuickGameSession ? notificationBell : null}
    </MobileBottomNavShell>
  );
}
