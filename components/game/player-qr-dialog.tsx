"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PlayerQrDialog({
  displayName,
  personalQrCode,
  personalQrCodeDataUrl,
  open,
  onOpenChange,
}: {
  displayName: string;
  personalQrCode?: string;
  personalQrCodeDataUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="player-qr-dialog max-w-[min(96vw,28rem)] gap-3 border-border p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle>{displayName} · QR code</DialogTitle>
        </DialogHeader>
        <div className="player-qr-dialog-frame flex max-h-[min(85vh,32rem)] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={personalQrCodeDataUrl}
            alt={`Personal QR for ${displayName}`}
            className="max-h-[min(75vh,28rem)] w-full max-w-[min(75vw,24rem)] object-contain"
          />
          {personalQrCode ? (
            <p className="break-all text-center text-sm text-muted-foreground">{personalQrCode}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
