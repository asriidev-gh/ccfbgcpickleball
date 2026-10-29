"use client";

import { useState, type ReactNode } from "react";

import { PlayerPhotoDialog, type PlayerPhotoRef } from "@/components/game/player-photo-dialog";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

/** Wraps an avatar so tapping it opens the full-size photo in a modal. */
export function PhotoLightboxTrigger({
  player,
  className,
  children,
}: {
  player: PlayerPhotoRef;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const name = formatPlayerDisplayName(player.firstName, player.lastName) || "player";

  return (
    <>
      <button
        type="button"
        className={cn(
          "shrink-0 cursor-zoom-in rounded-full outline-none transition-opacity hover:opacity-90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label={`View ${name}'s photo`}
      >
        {children}
      </button>
      {open ? <PlayerPhotoDialog player={player} open onOpenChange={setOpen} /> : null}
    </>
  );
}
