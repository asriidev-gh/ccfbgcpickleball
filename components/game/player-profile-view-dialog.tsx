"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PlayerPhotoDialog, type PlayerPhotoRef } from "@/components/game/player-photo-dialog";
import { PlayerQrDialog } from "@/components/game/player-qr-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import type { OwnerPlayerProfile } from "@/lib/owner-registered-players-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import {
  GENDER_OPTIONS,
  PICKLEBALL_LEVELS,
} from "@/lib/player-profile-shared";
import { formatPlayerDisplayName } from "@/lib/utils";

type PlayerQrPayload = {
  firstName: string;
  personalQrCode: string;
  personalQrCodeDataUrl: string;
  message?: string;
};

function labelForValue(
  value: string,
  options: ReadonlyArray<{ value: string; label: string }>,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function ProfileDetail({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  const text = value?.trim();
  if (!text) return null;

  return (
    <div className={className ?? "player-profile-detail space-y-1"}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm leading-relaxed text-foreground">{text}</dd>
    </div>
  );
}

function formatYesNo(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

export function PlayerProfileViewDialog({
  playerId,
  player,
  open,
  onOpenChange,
}: {
  playerId: string;
  player: PlayerPhotoRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const displayName =
    formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
  const photoUrl = resolvePlayerPhotoUrl(player, 320);

  const profileQuery = useQuery({
    queryKey: ["owner-player-profile", playerId],
    enabled: open && Boolean(playerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/profile`,
      );
      const payload = (await response.json()) as OwnerPlayerProfile & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load player profile.");
      return payload;
    },
  });

  const qrQuery = useQuery({
    queryKey: ["owner-player-qr", playerId],
    enabled: open && Boolean(playerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/qr`,
      );
      const payload = (await response.json()) as PlayerQrPayload;
      if (!response.ok) throw new Error(payload.message ?? "Failed to load player QR code.");
      return payload;
    },
    retry: false,
  });

  const profile = profileQuery.data;

  const copyQrCode = async () => {
    const code = qrQuery.data?.personalQrCode?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Personal QR ID copied.");
    } catch {
      toast.error("Could not copy QR ID.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="player-profile-view-dialog flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
              {displayName}
              {profile?.isBlocked ? (
                <Badge variant="destructive" className="text-[0.625rem]">
                  Blocked
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>Registration profile and personal QR code.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {profileQuery.isLoading ? (
              <p className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading profile…
              </p>
            ) : profileQuery.isError ? (
              <p className="py-8 text-sm text-destructive">
                {profileQuery.error instanceof Error
                  ? profileQuery.error.message
                  : "Failed to load profile."}
              </p>
            ) : profile ? (
              <div className="space-y-5">
                <button
                  type="button"
                  className="player-profile-view-photo mx-auto block overflow-hidden rounded-xl border border-border/70 bg-muted/30 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View full photo of ${displayName}`}
                  onClick={() => setPhotoOpen(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={`${displayName} profile`}
                    className="mx-auto block size-28 object-cover sm:size-32"
                  />
                </button>

                <dl className="player-profile-details grid gap-4 sm:grid-cols-2">
                  <ProfileDetail label="First name" value={profile.firstName} />
                  <ProfileDetail label="Last name" value={profile.lastName} />
                  <ProfileDetail label="Email" value={profile.email} />
                  <ProfileDetail label="Mobile number" value={profile.mobileNumber} />
                  <ProfileDetail
                    label="Gender"
                    value={profile.gender ? labelForValue(profile.gender, GENDER_OPTIONS) : ""}
                  />
                  <ProfileDetail label="Birthdate" value={profile.birthdate} />
                  <ProfileDetail
                    label="Pickleball level"
                    value={
                      profile.pickleballLevel
                        ? labelForValue(profile.pickleballLevel, PICKLEBALL_LEVELS)
                        : ""
                    }
                  />
                  <ProfileDetail
                    label="Biography"
                    value={profile.biography}
                    className="player-profile-detail space-y-1 sm:col-span-2"
                  />
                </dl>

                {profile.showCcfQuestionnaire ? (
                  <section className="space-y-3 border-t border-border/60 pt-4">
                    <h3 className="text-sm font-semibold text-foreground">CCF questionnaire</h3>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <ProfileDetail
                        label="Attended CCF events before"
                        value={
                          profile.ccfEventsBefore === "not_yet"
                            ? "Not yet"
                            : profile.ccfEventsBefore === "yes"
                              ? "Yes"
                              : ""
                        }
                      />
                      {profile.attendedEvents.length > 0 ? (
                        <div className="player-profile-detail space-y-1 sm:col-span-2">
                          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Events attended
                          </dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {profile.attendedEvents.map((event) => (
                              <Badge key={event} variant="secondary" className="font-normal">
                                {event === CCF_ATTENDED_NOT_YET ? "Not yet" : event}
                              </Badge>
                            ))}
                          </dd>
                        </div>
                      ) : null}
                      <ProfileDetail
                        label="Part of a Dgroup"
                        value={formatYesNo(profile.isPartOfDgroup)}
                      />
                      <ProfileDetail
                        label="Wants to join a Dgroup"
                        value={formatYesNo(profile.wantsToJoinDgroup)}
                      />
                      <ProfileDetail
                        label="Other events"
                        value={profile.attendedEventsOther}
                        className="player-profile-detail space-y-1 sm:col-span-2"
                      />
                    </dl>
                  </section>
                ) : null}

                <section className="space-y-3 border-t border-border/60 pt-4">
                  <h3 className="text-sm font-semibold text-foreground">Personal QR code</h3>
                  {qrQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                    </div>
                  ) : qrQuery.isError ? (
                    <p className="text-sm text-muted-foreground">
                      {qrQuery.error instanceof Error
                        ? qrQuery.error.message
                        : "QR code unavailable."}
                    </p>
                  ) : qrQuery.data?.personalQrCodeDataUrl ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        className="player-profile-view-qr mx-auto flex w-fit cursor-pointer items-center justify-center rounded-xl bg-white p-3 shadow-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`View full QR code for ${displayName}`}
                        onClick={() => setQrOpen(true)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrQuery.data.personalQrCodeDataUrl}
                          alt={`Personal QR for ${displayName}`}
                          className="mx-auto block size-48 max-w-full object-contain"
                        />
                      </button>
                      <p className="break-all text-center text-sm text-muted-foreground">
                        {qrQuery.data.personalQrCode}
                      </p>
                      <Button type="button" variant="outline" className="w-full" onClick={copyQrCode}>
                        <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                        Copy QR ID
                      </Button>
                      <p className="text-center text-xs leading-relaxed text-muted-foreground">
                        Tap the QR code to zoom in, or use the button to copy the personal QR ID.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No personal QR code on file.</p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <PlayerPhotoDialog player={player} open={photoOpen} onOpenChange={setPhotoOpen} />
      {qrQuery.data?.personalQrCodeDataUrl ? (
        <PlayerQrDialog
          displayName={displayName}
          personalQrCode={qrQuery.data.personalQrCode}
          personalQrCodeDataUrl={qrQuery.data.personalQrCodeDataUrl}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      ) : null}
    </>
  );
}
