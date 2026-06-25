"use client";

import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type GameQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameTitle: string;
  registerUrl: string;
  qrCodeDataUrl: string;
  mode?: "registration" | "spectator";
  loading?: boolean;
};

function resolveQrDialogMode(registerUrl: string, mode?: GameQrDialogProps["mode"]) {
  if (mode) return mode;
  return registerUrl.includes("/spectate") ? "spectator" : "registration";
}

export function GameQrDialog({
  open,
  onOpenChange,
  gameTitle,
  registerUrl,
  qrCodeDataUrl,
  mode,
  loading = false,
}: GameQrDialogProps) {
  const dialogMode = resolveQrDialogMode(registerUrl, mode);
  const isSpectator = dialogMode === "spectator";
  const showQr = !loading && Boolean(registerUrl && qrCodeDataUrl);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(registerUrl);
      toast.success(isSpectator ? "Spectator link copied." : "Registration link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="game-qr-dialog max-w-md justify-items-center text-center sm:max-w-md">
        <DialogHeader className="w-full items-center text-center sm:text-center">
          <DialogTitle>{isSpectator ? "Spectator view QR" : "Player registration QR"}</DialogTitle>
          <DialogDescription className="text-center">
            {isSpectator ? (
              <>
                Scan with a phone camera to open the live spectator view for{" "}
                <span className="font-medium text-foreground">{gameTitle}</span>.
              </>
            ) : (
              <>
                Scan with a phone camera to open player registration for{" "}
                <span className="font-medium text-foreground">{gameTitle}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <div className="game-qr-frame mx-auto flex w-fit min-h-64 min-w-64 items-center justify-center rounded-xl bg-white p-3 shadow-sm">
            {showQr ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeDataUrl}
                  alt={
                    isSpectator
                      ? `QR code for ${gameTitle} spectator view`
                      : `QR code for ${gameTitle} registration`
                  }
                  className="game-qr-image mx-auto block size-64 max-w-[min(280px,calc(100vw-4rem))] object-contain"
                />
              </>
            ) : (
              <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>
          {showQr ? (
            <>
              <p className="w-full break-all text-center text-sm text-muted-foreground">{registerUrl}</p>
              <div className="flex w-full max-w-sm flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={copyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
                <Link href={registerUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open page
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading registration QR…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
