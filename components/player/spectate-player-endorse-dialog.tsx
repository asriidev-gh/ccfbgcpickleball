"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Gift,
  Handshake,
  Heart,
  Laugh,
  Lightbulb,
  Loader2,
  Rocket,
  Scale,
  Smile,
  Star,
  Target,
  ThumbsUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { queuePlayerActionDialogFooterClass } from "@/components/game/queue-player-action-button-styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchSpectatePlayerEndorsements,
  spectateGameEndorsementCountsQueryKey,
  spectatePlayerEndorsementsQueryKey,
  submitSpectatePlayerEndorsement,
} from "@/lib/fetch-spectate-player-endorsement";
import {
  MAX_PLAYER_ENDORSEMENT_BADGES,
  MAX_PLAYER_ENDORSEMENT_NOTES,
  PLAYER_ENDORSEMENT_BADGES,
  PLAYER_ENDORSEMENT_BADGE_LABELS,
  type PlayerEndorsementBadge,
} from "@/lib/player-endorsement-shared";
import { formatPlayerDisplayName } from "@/lib/utils";
import { cn } from "@/lib/utils";

const BADGE_ICONS: Record<PlayerEndorsementBadge, LucideIcon> = {
  friendly: Smile,
  enthusiastic: Heart,
  competitive: Trophy,
  inspiring: Rocket,
  fair: Scale,
  organized: Star,
  punctual: Clock,
  funny: Laugh,
  smart: Lightbulb,
  focused: Target,
  generous: Gift,
  helpful: Handshake,
};

type SpectatePlayerEndorseDialogProps = {
  gameId: string;
  endorserPlayerId: string;
  entry: QueueEntryView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpectatePlayerEndorseDialog({
  gameId,
  endorserPlayerId,
  entry,
  open,
  onOpenChange,
}: SpectatePlayerEndorseDialogProps) {
  const queryClient = useQueryClient();
  const [selectedBadges, setSelectedBadges] = useState<PlayerEndorsementBadge[]>([]);
  const [notes, setNotes] = useState("");

  const endorsedPlayerId = entry?.playerId._id
    ? String(entry.playerId._id)
    : "";
  const endorsedPlayerName = entry
    ? formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName) || "Player"
    : "Player";

  const { data: endorsements } = useQuery({
    queryKey: spectatePlayerEndorsementsQueryKey(gameId, endorserPlayerId),
    queryFn: () => fetchSpectatePlayerEndorsements(gameId, endorserPlayerId),
    enabled: open && Boolean(endorserPlayerId),
    staleTime: 0,
  });

  const existingEndorsement = useMemo(
    () => endorsements?.find((item) => item.endorsedPlayerId === endorsedPlayerId) ?? null,
    [endorsements, endorsedPlayerId],
  );

  useEffect(() => {
    if (!open) {
      setSelectedBadges([]);
      setNotes("");
      return;
    }
    if (existingEndorsement) {
      setSelectedBadges(existingEndorsement.badges);
      setNotes(existingEndorsement.notes);
    }
  }, [open, existingEndorsement]);

  const submitMutation = useMutation({
    mutationFn: async () =>
      submitSpectatePlayerEndorsement({
        gameId,
        endorserPlayerId,
        endorsedPlayerId,
        badges: selectedBadges,
        notes,
      }),
    onSuccess: (payload) => {
      toast.success(payload.message);
      void queryClient.invalidateQueries({
        queryKey: spectatePlayerEndorsementsQueryKey(gameId, endorserPlayerId),
      });
      void queryClient.invalidateQueries({
        queryKey: spectateGameEndorsementCountsQueryKey(gameId),
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to submit endorsement.");
    },
  });

  const toggleBadge = (badge: PlayerEndorsementBadge) => {
    if (existingEndorsement) return;
    setSelectedBadges((previous) => {
      if (previous.includes(badge)) {
        return previous.filter((item) => item !== badge);
      }
      if (previous.length >= MAX_PLAYER_ENDORSEMENT_BADGES) {
        return previous;
      }
      return [...previous, badge];
    });
  };

  const canSubmit =
    !existingEndorsement &&
    selectedBadges.length > 0 &&
    selectedBadges.length <= MAX_PLAYER_ENDORSEMENT_BADGES &&
    !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {entry ? (
          <>
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <DialogTitle>Endorse {endorsedPlayerName}</DialogTitle>
              <DialogDescription>Share what you enjoyed about playing together.</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-300 p-4 text-black shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/10 text-black">
                    <ThumbsUp className="size-5" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-black">Endorse</p>
                    <p className="text-sm leading-snug text-black/80">
                      I enjoyed playing with this player
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Select up to {MAX_PLAYER_ENDORSEMENT_BADGES} badges ·{" "}
                  {selectedBadges.length}/{MAX_PLAYER_ENDORSEMENT_BADGES}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_ENDORSEMENT_BADGES.map((badge) => {
                    const Icon = BADGE_ICONS[badge];
                    const selected = selectedBadges.includes(badge);
                    return (
                      <button
                        key={badge}
                        type="button"
                        disabled={Boolean(existingEndorsement)}
                        onClick={() => toggleBadge(badge)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                          existingEndorsement && !selected && "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-11 items-center justify-center rounded-2xl border",
                            selected
                              ? "border-primary-foreground/20 bg-primary-foreground/10"
                              : "border-border bg-muted/30",
                          )}
                        >
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="text-[11px] leading-tight font-medium">
                          {PLAYER_ENDORSEMENT_BADGE_LABELS[badge]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="endorse-notes" className="text-sm font-medium text-foreground">
                  Any additional notes?
                </label>
                <Textarea
                  id="endorse-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, MAX_PLAYER_ENDORSEMENT_NOTES))}
                  placeholder="Any additional notes?"
                  disabled={Boolean(existingEndorsement)}
                  className="min-h-24 resize-none border-border bg-background"
                />
              </div>

              {!existingEndorsement ? null : (
                <p className="text-sm text-muted-foreground">You already endorsed this player.</p>
              )}
            </div>

            <DialogFooter className={queuePlayerActionDialogFooterClass}>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => void submitMutation.mutate()}
                disabled={!canSubmit}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  <>
                    <ThumbsUp className="mr-2 size-4" aria-hidden />
                    Endorse now
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
