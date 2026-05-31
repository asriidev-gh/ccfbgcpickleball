"use client";

import { Loader2, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GameQrDialog } from "@/components/game/game-qr-dialog";
import {
  fetchGameRegistrationStatus,
  promptIfRegistrationFull,
} from "@/components/game/registration-capacity-prompt";
import { cn } from "@/lib/utils";

type GameQrTabletSquareProps = {
  gameId: string;
  gameTitle: string;
  /** Inside list-view rounded panel (no extra outer border on tap target) */
  embedded?: boolean;
  /** Scales QR to parent width (narrow card column). */
  compact?: boolean;
};

export function GameQrTabletSquare({
  gameId,
  gameTitle,
  embedded = false,
  compact = false,
}: GameQrTabletSquareProps) {
  const [loading, setLoading] = useState(true);
  const [registrationFull, setRegistrationFull] = useState(false);
  const [isSpectatorQr, setIsSpectatorQr] = useState(false);
  const [registerUrl, setRegisterUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadQr = async () => {
      setLoading(true);
      try {
        const status = await fetchGameRegistrationStatus(gameId);
        if (cancelled) return;

        const spectatorQr = status.allowQrRegistration === false;
        setIsSpectatorQr(spectatorQr);

        if (status.isFull && !spectatorQr) {
          setRegistrationFull(true);
          setRegisterUrl(null);
          setQrCodeDataUrl(null);
          return;
        }

        const response = await fetch(`/api/games/${gameId}/qr`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);

        if (!cancelled) {
          setRegisterUrl(payload.registerUrl);
          setQrCodeDataUrl(payload.publicQrCodeDataUrl);
          setRegistrationFull(false);
          setIsSpectatorQr(
            spectatorQr || Boolean(payload.registerUrl?.includes("/spectate")),
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load registration QR.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadQr();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const handleClick = async () => {
    if (registrationFull) {
      await promptIfRegistrationFull(gameId);
      return;
    }
    if (qrCodeDataUrl && registerUrl) {
      setDialogOpen(true);
      return;
    }
    setLoading(true);
    try {
      const canProceed = await promptIfRegistrationFull(gameId);
      if (!canProceed) {
        setRegistrationFull(true);
        return;
      }
      const response = await fetch(`/api/games/${gameId}/qr`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      setRegisterUrl(payload.registerUrl);
      setQrCodeDataUrl(payload.publicQrCodeDataUrl);
      setIsSpectatorQr(Boolean(payload.registerUrl?.includes("/spectate")));
      setDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load registration QR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex w-full min-w-0 flex-col items-center",
          compact ? "gap-0.5" : "gap-2",
        )}
      >
        <button
          type="button"
          className={cn(
            "game-qr-tablet-square flex aspect-square flex-col items-center justify-center transition-colors",
            compact ? "w-full max-w-full" : "w-36 sm:w-40",
            embedded
              ? cn(
                  "rounded-2xl bg-transparent hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  compact ? "p-0.5" : "p-1",
                )
              : "rounded-xl border-2 border-border bg-muted/30 p-3 hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            registrationFull &&
              (embedded
                ? "cursor-not-allowed opacity-60 hover:bg-transparent"
                : "cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/30"),
          )}
          disabled={loading && !qrCodeDataUrl}
          aria-label={
            registrationFull
              ? `Registration full for ${gameTitle}`
              : isSpectatorQr
                ? `Open spectator QR for ${gameTitle}`
                : `Open registration QR for ${gameTitle}`
          }
          onClick={() => void handleClick()}
        >
          {loading ? (
            <Loader2
              className={cn(
                "animate-spin text-muted-foreground",
                compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-14 w-14",
              )}
              aria-hidden
            />
          ) : registrationFull ? (
            <QrCode
              className={cn(
                "text-muted-foreground/50",
                compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-14 w-14",
              )}
              aria-hidden
            />
          ) : qrCodeDataUrl ? (
            <div
              className={cn(
                "flex size-full items-center justify-center rounded-md bg-white",
                compact ? "p-0.5" : "rounded-lg p-1.5",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeDataUrl}
                alt={isSpectatorQr ? `Spectator QR for ${gameTitle}` : `Registration QR for ${gameTitle}`}
                className="size-full object-contain"
              />
            </div>
          ) : (
            <QrCode
              className={cn("text-primary/80", compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-14 w-14")}
              aria-hidden
            />
          )}
        </button>
        <span
          className={cn(
            "font-semibold tracking-wide text-muted-foreground uppercase",
            compact ? "text-[0.625rem] leading-none" : "text-xs",
          )}
        >
          {isSpectatorQr ? "Spectate" : "Register"}
        </span>
      </div>

      {registerUrl && qrCodeDataUrl ? (
        <GameQrDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          gameTitle={gameTitle}
          registerUrl={registerUrl}
          qrCodeDataUrl={qrCodeDataUrl}
          mode={isSpectatorQr ? "spectator" : "registration"}
        />
      ) : null}
    </>
  );
}
