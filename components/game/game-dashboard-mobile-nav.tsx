"use client";

import { Flag, House, Loader2, QrCode, RotateCcw, UserPlus } from "lucide-react";

import { MobileBottomNavButton, MobileBottomNavShell } from "@/components/mobile-bottom-nav";

type GameDashboardMobileNavProps = {
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
  return (
    <MobileBottomNavShell ariaLabel="Game actions">
      <MobileBottomNavButton
        href="/"
        label="Home"
        icon={<House className="h-5 w-5 shrink-0" aria-hidden />}
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
    </MobileBottomNavShell>
  );
}
