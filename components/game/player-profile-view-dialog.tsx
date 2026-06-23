"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { PlayerPhotoDialog, type PlayerPhotoRef } from "@/components/game/player-photo-dialog";
import {
  PlayerProfileDialogTabs,
  type PlayerProfileDialogTab,
} from "@/components/player/player-profile-dialog-tabs";
import { PlayerProfileQrSection } from "@/components/player/player-profile-qr-section";
import { Badge } from "@/components/ui/badge";
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
import { isPersistedPlayerId } from "@/lib/player-id";

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

function PlayerProfileDetailsGrid({ profile }: { profile: OwnerPlayerProfile }) {
  return (
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
  );
}

function PlayerCcfDetailsGrid({ profile }: { profile: OwnerPlayerProfile }) {
  return (
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
      <ProfileDetail label="Part of a Dgroup" value={formatYesNo(profile.isPartOfDgroup)} />
      <ProfileDetail label="Wants to join a Dgroup" value={formatYesNo(profile.wantsToJoinDgroup)} />
      <ProfileDetail
        label="Other events"
        value={profile.attendedEventsOther}
        className="player-profile-detail space-y-1 sm:col-span-2"
      />
    </dl>
  );
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
  const [activeTab, setActiveTab] = useState<PlayerProfileDialogTab>("profile");
  const displayName =
    formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
  const photoUrl = resolvePlayerPhotoUrl(player, 320);

  const profileQuery = useQuery({
    queryKey: ["owner-player-profile", playerId],
    enabled: open && isPersistedPlayerId(playerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/profile`,
      );
      const payload = (await response.json()) as OwnerPlayerProfile & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load player profile.");
      return payload;
    },
  });

  const profile = profileQuery.data;

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
              <PlayerProfileDialogTabs
                open={open}
                showCcf={profile.showCcfQuestionnaire}
                onTabChange={setActiveTab}
                profileContent={
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
                    <PlayerProfileDetailsGrid profile={profile} />
                  </div>
                }
                ccfContent={<PlayerCcfDetailsGrid profile={profile} />}
                qrContent={
                  <PlayerProfileQrSection
                    playerId={playerId}
                    displayName={displayName}
                    email={profile.email}
                    enabled={open && activeTab === "qr"}
                  />
                }
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <PlayerPhotoDialog player={player} open={photoOpen} onOpenChange={setPhotoOpen} />
    </>
  );
}
