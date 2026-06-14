"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode, type RefObject, type WheelEvent } from "react";
import {
  Building2,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  Sparkles,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { fetchSpectateClubProfile, spectateClubProfileQueryKey } from "@/lib/fetch-spectate-club-profile";
import { buildGoogleMapsSearchUrl, type SpectateClubProfile } from "@/lib/spectate-club-profile-shared";
import { cn } from "@/lib/utils";

function ClubSocialButton({
  href,
  label,
  icon,
  className,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
        className,
      )}
    >
      {icon}
      {label}
    </a>
  );
}

function ClubMapEmbed({
  src,
  title,
  scrollAreaRef,
  dialogOpen,
}: {
  src: string;
  title: string;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  dialogOpen: boolean;
}) {
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!dialogOpen) setInteractive(false);
  }, [dialogOpen]);

  const forwardWheelToScrollArea = (event: WheelEvent<HTMLDivElement>) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop += event.deltaY;
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
      <iframe
        title={title}
        src={src}
        className={cn(
          "aspect-[4/3] w-full border-0 sm:aspect-video lg:max-h-72",
          !interactive && "pointer-events-none",
        )}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {!interactive ? (
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-black/35 via-black/5 to-transparent px-4 pb-3 pt-10 text-center"
          aria-label="Enable map interaction"
          onWheel={forwardWheelToScrollArea}
          onClick={() => setInteractive(true)}
        >
          <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            Scroll to explore · Click to interact with map
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="absolute right-2 top-2 z-10 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border/70 backdrop-blur-sm"
          onClick={() => setInteractive(false)}
        >
          Done
        </button>
      )}
    </div>
  );
}

function ClubProfileBody({
  profile,
  scrollAreaRef,
  dialogOpen,
}: {
  profile: SpectateClubProfile;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  dialogOpen: boolean;
}) {
  const socialLinks = [
    profile.clubFacebookUrl
      ? {
          href: profile.clubFacebookUrl,
          label: "Facebook",
          icon: <Link2 className="h-4 w-4 shrink-0" aria-hidden />,
          className:
            "border-[#1877f2]/30 bg-[#1877f2]/10 text-[#1877f2] hover:bg-[#1877f2]/15 dark:text-[#6ea8fe]",
        }
      : null,
    profile.clubInstagramUrl
      ? {
          href: profile.clubInstagramUrl,
          label: "Instagram",
          icon: <Link2 className="h-4 w-4 shrink-0" aria-hidden />,
          className:
            "border-pink-500/30 bg-pink-500/10 text-pink-700 hover:bg-pink-500/15 dark:text-pink-300",
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    icon: ReactNode;
    className: string;
  }>;

  const hasLocation = Boolean(profile.clubAddress || profile.clubGoogleMapEmbedUrl);
  const mapsSearchUrl = profile.clubAddress ? buildGoogleMapsSearchUrl(profile.clubAddress) : null;

  return (
    <div className="space-y-5 pb-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:pb-0">
      {socialLinks.length > 0 ? (
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          {socialLinks.map((link) => (
            <ClubSocialButton key={link.label} {...link} />
          ))}
        </div>
      ) : null}

      {profile.clubMissionVision ? (
        <section
          className={cn(
            "rounded-2xl border border-border/70 bg-muted/10 p-4 sm:p-5 lg:p-6",
            !hasLocation && "lg:col-span-2",
          )}
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground lg:text-base">
            <span className="flex size-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300 lg:size-9">
              <Target className="h-4 w-4" aria-hidden />
            </span>
            Mission & vision
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 lg:text-base">
            {profile.clubMissionVision}
          </p>
        </section>
      ) : null}

      {hasLocation ? (
        <section
          className={cn(
            "rounded-2xl border border-border/70 bg-muted/10",
            profile.clubMissionVision ? "lg:col-start-2" : "lg:col-span-2",
          )}
        >
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
              <MapPin className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">Visit us</p>
              {profile.clubAddress ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {profile.clubAddress}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Find us on the map below.</p>
              )}
              {mapsSearchUrl ? (
                <a
                  href={mapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary hover:underline"
                >
                  Open in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
          {profile.clubGoogleMapEmbedUrl ? (
            <div className="border-t border-border/60 bg-background/40 p-3 sm:p-4">
              <ClubMapEmbed
                src={profile.clubGoogleMapEmbedUrl}
                title={`Map for ${profile.clubName}`}
                scrollAreaRef={scrollAreaRef}
                dialogOpen={dialogOpen}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {!profile.clubMissionVision &&
      socialLinks.length === 0 &&
      !hasLocation ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center lg:col-span-2">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/70" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            More club details will appear here as your organizer completes their profile.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SpectateClubProfileDialog({
  gameId,
  open,
  onOpenChange,
}: {
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: spectateClubProfileQueryKey(gameId),
    queryFn: () => fetchSpectateClubProfile(gameId),
    enabled: open,
    staleTime: 60_000,
  });

  const profile = data;
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="spectate-club-profile-dialog flex max-h-[92dvh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]]:right-3 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/20 [&_[data-slot=dialog-close]]:bg-black/20 [&_[data-slot=dialog-close]]:text-white hover:[&_[data-slot=dialog-close]]:bg-black/30 lg:[&_[data-slot=dialog-close]]:top-4 lg:[&_[data-slot=dialog-close]]:right-4"
      >
        {isLoading ? (
          <div className="flex min-h-80 items-center justify-center text-muted-foreground md:min-h-96">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading club profile…
          </div>
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load club profile."}
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : profile ? (
          <>
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-violet-600/90 via-sky-600/80 to-indigo-700/90 px-5 pb-16 pt-8 text-white sm:px-6 sm:pb-20 sm:pt-10 lg:px-8 lg:pb-24 lg:pt-12">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
              <div className="relative mx-auto max-w-sm text-center lg:max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 lg:text-xs">
                  Club profile
                </p>
              </div>
            </div>

            <div className="relative -mt-12 shrink-0 px-5 sm:-mt-14 sm:px-6 lg:-mt-16 lg:px-8">
              <div className="mx-auto flex max-w-sm flex-col items-center text-center lg:max-w-2xl">
                {profile.clubLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.clubLogoUrl}
                    alt=""
                    className="size-24 shrink-0 rounded-[1.35rem] border-4 border-background bg-background object-cover p-1 shadow-lg sm:size-28 lg:size-32"
                  />
                ) : (
                  <div className="flex size-24 shrink-0 items-center justify-center rounded-[1.35rem] border-4 border-background bg-background text-violet-600 shadow-lg sm:size-28 lg:size-32 dark:text-violet-300">
                    <Building2 className="h-10 w-10 lg:h-12 lg:w-12" aria-hidden />
                  </div>
                )}
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem] lg:text-3xl">
                  {profile.clubName}
                </h2>
                {profile.clubTagline ? (
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground lg:max-w-xl lg:text-base">
                    {profile.clubTagline}
                  </p>
                ) : null}
                {profile.clubAdditionalInfo ? (
                  <p className="mt-3 max-w-xs whitespace-pre-wrap text-sm leading-relaxed text-foreground/85 lg:max-w-xl lg:text-base">
                    {profile.clubAdditionalInfo}
                  </p>
                ) : null}
              </div>
            </div>

            <div
              ref={scrollAreaRef}
              className="spectate-club-profile-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-6 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 lg:pt-8"
            >
              <ClubProfileBody profile={profile} scrollAreaRef={scrollAreaRef} dialogOpen={open} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
