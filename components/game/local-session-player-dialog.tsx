"use client";

import { useMemo } from "react";

import type { PlayerPhotoRef } from "@/components/game/player-photo-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GENDER_OPTIONS, PICKLEBALL_LEVELS } from "@/lib/player-profile-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { formatPlayerDisplayName } from "@/lib/utils";

function labelForValue(
  value: string,
  options: ReadonlyArray<{ value: string; label: string }>,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function LocalSessionPlayerDialog({
  player,
  open,
  onOpenChange,
}: {
  player: PlayerPhotoRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const displayName = formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
  const photoUrl = useMemo(() => resolvePlayerPhotoUrl(player, 320), [player]);
  const genderLabel = player.gender
    ? labelForValue(player.gender, GENDER_OPTIONS)
    : null;
  const levelLabel = player.openPlayLevel?.trim()
    || (player.pickleballLevel
      ? labelForValue(player.pickleballLevel, PICKLEBALL_LEVELS)
      : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="player-profile-view-dialog flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>Quick play session player — not saved to the server.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={`${displayName} profile`}
              className="mx-auto block size-28 rounded-xl border border-border/70 object-cover sm:size-32"
            />
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  First name
                </dt>
                <dd className="text-sm text-foreground">{player.firstName || "—"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Last name
                </dt>
                <dd className="text-sm text-foreground">{player.lastName || "—"}</dd>
              </div>
              {genderLabel ? (
                <div className="space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Gender
                  </dt>
                  <dd className="text-sm text-foreground">{genderLabel}</dd>
                </div>
              ) : null}
              {levelLabel ? (
                <div className="space-y-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Level
                  </dt>
                  <dd className="text-sm text-foreground">{levelLabel}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
