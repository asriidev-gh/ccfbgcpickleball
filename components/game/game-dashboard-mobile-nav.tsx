"use client";

import { Flag, House, Loader2, QrCode, RotateCcw, Trophy, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";

import { GameCheckoutNotificationBell } from "@/components/game/spectator-notification-bell";
import { MobileBottomNavButton, MobileBottomNavShell } from "@/components/mobile-bottom-nav";

type GameDashboardMobileNavProps = {
  gameId: string;
  isQuickGameSession?: boolean;
  homeHref?: string;
  homeLabel?: string;
  showQr: boolean;
  qrLoading: boolean;
  onQrClick: () => void;
  showDatabaseCheckIn: boolean;
  onDatabaseCheckInClick: () => void;
  showEndOpenPlay: boolean;
  endOpenPlayPending: boolean;
  onEndOpenPlay: () => void;
  showReset: boolean;
  resetPending: boolean;
  onReset: () => void;
};

export function GameDashboardMobileNav({
  gameId,
  isQuickGameSession = false,
  homeHref = "/",
  homeLabel = "Home",
  showQr,
  qrLoading,
  onQrClick,
  showDatabaseCheckIn,
  onDatabaseCheckInClick,
  showEndOpenPlay,
  endOpenPlayPending,
  onEndOpenPlay,
  showReset,
  resetPending,
  onReset,
}: GameDashboardMobileNavProps) {
  const pathname = usePathname();
  const leaderboardHref = `/leaderboard/${gameId}`;
  const isLeaderboard = pathname === leaderboardHref;
  const notificationBell = (
    <GameCheckoutNotificationBell gameId={gameId} variant="mobileNav" iconOnly />
  );
  const homeButton = (
    <MobileBottomNavButton
      href={homeHref}
      label={homeLabel}
      icon={<House className="h-5 w-5 shrink-0" aria-hidden />}
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
      {showDatabaseCheckIn ? (
        <MobileBottomNavButton
          label="Check in"
          onClick={onDatabaseCheckInClick}
          icon={<UserPlus className="h-5 w-5 shrink-0" aria-hidden />}
        />
      ) : null}
      {showEndOpenPlay ? (
        <MobileBottomNavButton
          label={endOpenPlayPending ? "Ending…" : "End Open Play"}
          disabled={endOpenPlayPending}
          destructive
          onClick={onEndOpenPlay}
          icon={
            endOpenPlayPending ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Flag className="h-5 w-5 shrink-0" aria-hidden />
            )
          }
        />
      ) : null}
      {showReset ? (
        <MobileBottomNavButton
          label={resetPending ? "Resetting…" : "Reset"}
          disabled={resetPending}
          destructive
          onClick={onReset}
          icon={
            resetPending ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="h-5 w-5 shrink-0" aria-hidden />
            )
          }
        />
      ) : null}
      {!isQuickGameSession ? notificationBell : null}
    </MobileBottomNavShell>
  );
}
