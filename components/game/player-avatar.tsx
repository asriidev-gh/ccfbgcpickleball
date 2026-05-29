"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isUploadedPlayerPhoto,
  resolvePlayerPhotoUrl,
  type PlayerAvatarSeed,
} from "@/lib/player-avatar-url";
import { capitalizeNameWords, cn } from "@/lib/utils";

export type PlayerPhotoRef = PlayerAvatarSeed;

function getInitials(firstName: string, lastName: string) {
  const first = firstName.trim()[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

type PlayerAvatarProps = {
  player: PlayerPhotoRef;
  size?: "sm" | "default" | "lg";
  className?: string;
};

const PLAYER_AVATAR_SIZE_CLASS = "size-12 sm:size-14";

function isPodiumAvatar(className?: string) {
  return Boolean(className?.includes("leaderboard-podium-avatar"));
}

function PlayerAvatarImage({
  player,
  photoUrl,
  size = "lg",
  className,
}: PlayerAvatarProps & { photoUrl: string }) {
  const initials = getInitials(player.firstName, player.lastName);
  const displayName =
    `${capitalizeNameWords(player.firstName)} ${capitalizeNameWords(player.lastName)}`.trim();
  const podium = isPodiumAvatar(className);

  return (
    <Avatar
      size={podium ? "default" : size}
      className={cn(
        "player-avatar shrink-0",
        !podium && PLAYER_AVATAR_SIZE_CLASS,
        className,
      )}
    >
      <AvatarImage src={photoUrl} alt={displayName ? `${displayName} photo` : "Player photo"} />
      <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function PlayerAvatar({ player, size = "lg", className }: PlayerAvatarProps) {
  const [open, setOpen] = useState(false);
  const photoUrl = useMemo(() => resolvePlayerPhotoUrl(player), [player]);
  const lightboxUrl = useMemo(() => resolvePlayerPhotoUrl(player, 512), [player]);
  const canExpand = isUploadedPlayerPhoto(player);
  const displayName =
    `${capitalizeNameWords(player.firstName)} ${capitalizeNameWords(player.lastName)}`.trim() ||
    "Player";

  const avatar = (
    <PlayerAvatarImage player={player} photoUrl={photoUrl} size={size} className={className} />
  );

  if (!canExpand) {
    return avatar;
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "player-avatar-trigger shrink-0 rounded-full outline-none",
          "cursor-zoom-in transition-opacity hover:opacity-90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label={`View full photo of ${displayName}`}
        onClick={() => setOpen(true)}
      >
        {avatar}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="player-photo-dialog max-w-[min(96vw,56rem)] gap-3 border-border p-3 sm:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle>{displayName}</DialogTitle>
          </DialogHeader>
          <div className="player-photo-dialog-frame flex max-h-[min(85vh,48rem)] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt={`${displayName} — full size`}
              className="max-h-[min(85vh,48rem)] w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type PlayerNameWithPhotoProps = {
  player: PlayerPhotoRef;
  children: ReactNode;
  className?: string;
};

export function PlayerNameWithPhoto({ player, children, className }: PlayerNameWithPhotoProps) {
  return (
    <div className={cn("player-identity flex min-w-0 items-center gap-3", className)}>
      <PlayerAvatar player={player} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}
