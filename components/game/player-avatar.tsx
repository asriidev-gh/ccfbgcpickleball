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
import { resolvePlayerPhotoUrl, type PlayerAvatarSeed } from "@/lib/player-avatar-url";
import { capitalizeNameWords, cn } from "@/lib/utils";

export type PlayerPhotoRef = PlayerAvatarSeed;

function getInitials(firstName: string, lastName: string) {
  const first = firstName.trim()[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function getDisplayName(player: PlayerPhotoRef) {
  return (
    `${capitalizeNameWords(player.firstName)} ${capitalizeNameWords(player.lastName)}`.trim() ||
    "Player"
  );
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
  const displayName = getDisplayName(player);
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

function PlayerPhotoDialog({
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

/**
 * Wraps any content in a button that opens the player's photo/avatar at full
 * size. Use for names or custom markup so clicking them mirrors the avatar.
 */
export function PlayerPhotoTrigger({
  player,
  children,
  className,
}: {
  player: PlayerPhotoRef;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayName = getDisplayName(player);

  return (
    <>
      <button
        type="button"
        className={cn(
          "min-w-0 max-w-full cursor-pointer rounded text-left outline-none",
          "transition-opacity hover:opacity-90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        aria-label={`View photo of ${displayName}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <PlayerPhotoDialog player={player} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function PlayerAvatar({ player, size = "lg", className }: PlayerAvatarProps) {
  const [open, setOpen] = useState(false);
  const photoUrl = useMemo(() => resolvePlayerPhotoUrl(player), [player]);
  const displayName = getDisplayName(player);

  return (
    <>
      <button
        type="button"
        className={cn(
          "player-avatar-trigger shrink-0 rounded-full outline-none",
          "cursor-pointer transition-opacity hover:opacity-90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label={`View full photo of ${displayName}`}
        onClick={() => setOpen(true)}
      >
        <PlayerAvatarImage player={player} photoUrl={photoUrl} size={size} className={className} />
      </button>
      <PlayerPhotoDialog player={player} open={open} onOpenChange={setOpen} />
    </>
  );
}

type PlayerNameWithPhotoProps = {
  player: PlayerPhotoRef;
  children: ReactNode;
  className?: string;
  nameClassName?: string;
};

export function PlayerNameWithPhoto({
  player,
  children,
  className,
  nameClassName,
}: PlayerNameWithPhotoProps) {
  return (
    <div className={cn("player-identity flex min-w-0 items-center gap-3", className)}>
      <PlayerAvatar player={player} />
      <PlayerPhotoTrigger player={player} className={cn("flex-1 truncate", nameClassName)}>
        <span className="min-w-0 truncate">{children}</span>
      </PlayerPhotoTrigger>
    </div>
  );
}
