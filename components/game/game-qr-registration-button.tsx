"use client";

import { QrCode } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";

import { GameQrDialog } from "@/components/game/game-qr-dialog";
import { Button } from "@/components/ui/button";

type GameQrRegistrationButtonProps = {
  gameId: string;
  gameTitle: string;
} & Partial<Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">>;

export function GameQrRegistrationButton({
  gameId,
  gameTitle,
  variant = "outline",
  size,
  className,
}: GameQrRegistrationButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerUrl, setRegisterUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const openQrDialog = async () => {
    if (registerUrl && qrCodeDataUrl) {
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/games/${gameId}/qr`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      setRegisterUrl(payload.registerUrl);
      setQrCodeDataUrl(payload.publicQrCodeDataUrl);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load registration QR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
      {registerUrl && qrCodeDataUrl ? (
        <GameQrDialog
          open={open}
          onOpenChange={setOpen}
          gameTitle={gameTitle}
          registerUrl={registerUrl}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      ) : null}
    </>
  );
}
