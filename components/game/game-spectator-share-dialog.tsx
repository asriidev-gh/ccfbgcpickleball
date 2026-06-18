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
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-w-0 flex-1" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              Copy link
            </Button>
            <Link
              href={spectatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1"
            >
              <Button type="button" variant="outline" className="w-full">
                <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                Open new tab
              </Button>
            </Link>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Copy the link to share, or open the spectator view in a new tab.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
