"use client";

import { Loader2, QrCode } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";

import { GameQrDialog } from "@/components/game/game-qr-dialog";
import {
  fetchGameRegistrationStatus,
  promptIfRegistrationFull,
} from "@/components/game/registration-capacity-prompt";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GameQrRegistrationButtonProps = {
  gameId: string;
  gameTitle: string;
  iconOnly?: boolean;
  /** Card header: top-right with REGISTER label */
  cardCorner?: boolean;
} & Partial<Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">>;

export function GameQrRegistrationButton({
  gameId,
  gameTitle,
  iconOnly = false,
  cardCorner = false,
  variant = "outline",
  size,
  className,
}: GameQrRegistrationButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSpectatorQr, setIsSpectatorQr] = useState(false);
  const [registerUrl, setRegisterUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const openQrDialog = async () => {
    setLoading(true);
    try {
      const status = await fetchGameRegistrationStatus(gameId);
      const spectatorQr = status.allowQrRegistration === false;
      setIsSpectatorQr(spectatorQr);

      const canProceed = await promptIfRegistrationFull(gameId);
      if (!canProceed) return;

      if (registerUrl && qrCodeDataUrl) {
        setOpen(true);
        return;
      }
      const response = await fetch(`/api/games/${gameId}/qr`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      setRegisterUrl(payload.registerUrl);
      setQrCodeDataUrl(payload.publicQrCodeDataUrl);
      setIsSpectatorQr(spectatorQr || payload.registerUrl?.includes("/spectate"));
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load registration QR.");
    } finally {
      setLoading(false);
    }
  };

  const qrButton = cardCorner ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 shrink-0 gap-1.5 px-2.5 text-xs font-semibold tracking-wide uppercase",
        className,
      )}
      disabled={loading}
      aria-label={
        loading ? `Loading registration QR for ${gameTitle}` : `Register players for ${gameTitle}`
      }
      onClick={openQrDialog}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <QrCode className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      Register
    </Button>
  ) : iconOnly ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-9 shrink-0", className)}
      disabled={loading}
      aria-label={
        loading ? `Loading QR for ${gameTitle}` : `QR registration for ${gameTitle}`
      }
      onClick={openQrDialog}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <QrCode className="h-4 w-4" aria-hidden />
      )}
    </Button>
  ) : (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={openQrDialog}
    >
      <QrCode className="mr-2 h-4 w-4" />
      QR Registration
    </Button>
  );

  return (
    <>
      {qrButton}
      {registerUrl && qrCodeDataUrl ? (
        <GameQrDialog
          open={open}
          onOpenChange={setOpen}
          gameTitle={gameTitle}
          registerUrl={registerUrl}
          qrCodeDataUrl={qrCodeDataUrl}
          mode={isSpectatorQr ? "spectator" : "registration"}
        />
      ) : null}
    </>
  );
}
