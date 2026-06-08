"use client";

import { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolvePlayerPhotoUrl, type PlayerAvatarSeed } from "@/lib/player-avatar-url";
import { formatPlayerDisplayName } from "@/lib/utils";

export type PlayerPhotoRef = PlayerAvatarSeed;

function getDisplayName(player: PlayerPhotoRef) {
  return formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
}

export function PlayerPhotoDialog({
  player,
  open,
  onOpenChange,
}: {
  player: PlayerPhotoRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lightboxUrl = useMemo(() => resolvePlayerPhotoUrl(player, 512), [player]);
  const displayName = getDisplayName(player);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="player-photo-dialog max-w-[min(96vw,40rem)] gap-3 border-border p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle>{displayName}</DialogTitle>
        </DialogHeader>
        <div className="player-photo-dialog-frame flex max-h-[min(85vh,44rem)] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt={`${displayName} — full size`}
            className="max-h-[min(85vh,44rem)] w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
