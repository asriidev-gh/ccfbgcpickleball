"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { useGamePlayerProfile } from "@/components/game/game-player-profile-context";
import { LocalSessionPlayerDialog } from "@/components/game/local-session-player-dialog";
import { PlayerPhotoDialog, type PlayerPhotoRef } from "@/components/game/player-photo-dialog";
import { PlayerProfileViewDialog } from "@/components/game/player-profile-view-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isLocalSessionPlayerId, isPersistedPlayerId } from "@/lib/player-id";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { resolvePlayerId } from "@/lib/resolve-player-id";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type { PlayerPhotoRef };
export { resolvePlayerId };

function getInitials(firstName: string, lastName: string) {
  const display = formatPlayerDisplayName(firstName, lastName);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getDisplayName(player: PlayerPhotoRef) {
  return formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
}

type PlayerAvatarProps = {
  player: PlayerPhotoRef;
  size?: "sm" | "default" | "lg";
  className?: string;
  onClick?: () => void;
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

/**
 * Opens the registration profile when enabled on the game dashboard; otherwise
 * falls back to the photo lightbox.
 */
export function PlayerProfileTrigger({
  player,
  children,
  className,
}: {
  player: PlayerPhotoRef;
  children: ReactNode;
  className?: string;
}) {
  const { profileEnabled } = useGamePlayerProfile();
  const playerId = resolvePlayerId(player);
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = getDisplayName(player);
  const showRegisteredProfile = profileEnabled && isPersistedPlayerId(playerId);
  const showLocalProfile = profileEnabled && isLocalSessionPlayerId(playerId);

  if (!showRegisteredProfile && !showLocalProfile) {
    return (
      <PlayerPhotoTrigger player={player} className={className}>
        {children}
      </PlayerPhotoTrigger>
    );
  }

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
        aria-label={`View profile of ${displayName}`}
        onClick={() => setProfileOpen(true)}
      >
        {children}
      </button>
      {showLocalProfile ? (
        <LocalSessionPlayerDialog
          player={player}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      ) : (
        <PlayerProfileViewDialog
          playerId={playerId!}
          player={player}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}
    </>
  );
}

/**
 * Wraps any content in a button that opens the player's photo at full size.
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

export function PlayerAvatar({ player, size = "lg", className, onClick }: PlayerAvatarProps) {
  const [open, setOpen] = useState(false);
  const photoUrl = useMemo(() => resolvePlayerPhotoUrl(player), [player]);
  const displayName = getDisplayName(player);

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          "player-avatar-trigger shrink-0 rounded-full outline-none",
          "cursor-pointer transition-opacity hover:opacity-90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label={onClick ? `View info for ${displayName}` : `View full photo of ${displayName}`}
        onClick={handleClick}
      >
        <PlayerAvatarImage player={player} photoUrl={photoUrl} size={size} className={className} />
      </button>
      {onClick ? null : (
        <PlayerPhotoDialog player={player} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

type PlayerNameWithPhotoProps = {
  player: PlayerPhotoRef;
  children: ReactNode;
  className?: string;
  nameClassName?: string;
  /** When set, clicking the name opens this handler instead of profile/photo. */
  onPlayerClick?: () => void;
};

export function PlayerNameWithPhoto({
  player,
  children,
  className,
  nameClassName,
  onPlayerClick,
}: PlayerNameWithPhotoProps) {
  return (
    <div className={cn("player-identity flex min-w-0 items-center gap-3", className)}>
      <PlayerAvatar player={player} onClick={onPlayerClick} />
      {onPlayerClick ? (
        <button
          type="button"
          className={cn(
            "min-w-0 max-w-full flex-1 cursor-pointer truncate rounded text-left outline-none",
            "transition-opacity hover:opacity-90",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            nameClassName,
          )}
          onClick={onPlayerClick}
        >
          <span className="min-w-0 truncate">{children}</span>
        </button>
      ) : (
        <PlayerProfileTrigger player={player} className={cn("flex-1 truncate", nameClassName)}>
          <span className="min-w-0 truncate">{children}</span>
        </PlayerProfileTrigger>
      )}
    </div>
  );
}
