"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type GameSpectatorShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameTitle: string;
  spectatorUrl: string;
};

export function GameSpectatorShareDialog({
  open,
  onOpenChange,
  gameTitle,
  spectatorUrl,
}: GameSpectatorShareDialogProps) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(spectatorUrl);
      toast.success("Spectator view URL copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="game-spectator-share-dialog max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share spectator view</DialogTitle>
          <DialogDescription>
            Anyone with this link can watch the live queue and courts for{" "}
            <span className="font-medium text-foreground">{gameTitle}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="break-all rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-sm text-foreground">
            {spectatorUrl}
          </p>
          <Button type="button" className="w-full" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Copy link
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Click the button to copy and paste the spectator view URL.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
