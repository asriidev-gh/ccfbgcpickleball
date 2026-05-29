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

type GameQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameTitle: string;
  registerUrl: string;
  qrCodeDataUrl: string;
};

export function GameQrDialog({
  open,
  onOpenChange,
  gameTitle,
  registerUrl,
  qrCodeDataUrl,
}: GameQrDialogProps) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(registerUrl);
      toast.success("Registration link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="game-qr-dialog max-w-md">
        <DialogHeader>
          <DialogTitle>Player registration QR</DialogTitle>
          <DialogDescription>
            Scan with a phone camera to open CCF player registration for{" "}
            <span className="font-medium text-foreground">{gameTitle}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="game-qr-frame rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeDataUrl}
              alt={`QR code for ${gameTitle} registration`}
              className="game-qr-image h-auto w-[min(100%,280px)]"
            />
          </div>
          <p className="w-full break-all text-center text-sm text-muted-foreground">{registerUrl}</p>
          <div className="flex w-full flex-wrap gap-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
