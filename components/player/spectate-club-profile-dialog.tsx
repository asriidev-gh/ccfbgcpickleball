"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
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

function ClubProfileBody({ profile }: { profile: SpectateClubProfile }) {
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
    <div className="space-y-5 pb-2">
      {socialLinks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {socialLinks.map((link) => (
            <ClubSocialButton key={link.label} {...link} />
          ))}
        </div>
      ) : null}

      {profile.clubMissionVision ? (
        <section className="rounded-2xl border border-border/70 bg-muted/10 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
              <Target className="h-4 w-4" aria-hidden />
            </span>
            Mission & vision
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {profile.clubMissionVision}
          </p>
        </section>
      ) : null}

      {hasLocation ? (
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-muted/10">
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
              <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
                <iframe
                  title={`Map for ${profile.clubName}`}
                  src={profile.clubGoogleMapEmbedUrl}
                  className="aspect-[4/3] w-full border-0 sm:aspect-video"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!profile.clubMissionVision &&
      socialLinks.length === 0 &&
      !hasLocation ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center">
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
    queryKey: ["spectate-club-profile", gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/spectate/club-profile`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load club profile.");
      return payload as { profile: SpectateClubProfile };
    },
    enabled: open,
    staleTime: 60_000,
  });

  const profile = data?.profile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="spectate-club-profile-dialog max-h-[92dvh] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-md [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]]:right-3 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/20 [&_[data-slot=dialog-close]]:bg-black/20 [&_[data-slot=dialog-close]]:text-white hover:[&_[data-slot=dialog-close]]:bg-black/30"
      >
        {isLoading ? (
          <div className="flex min-h-80 items-center justify-center text-muted-foreground">
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
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-600/90 via-sky-600/80 to-indigo-700/90 px-5 pb-16 pt-8 text-white sm:px-6 sm:pb-20 sm:pt-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
              <div className="relative mx-auto max-w-sm text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                  Club profile
                </p>
              </div>
            </div>

            <div className="relative -mt-12 px-5 sm:-mt-14 sm:px-6">
              <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                {profile.clubLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.clubLogoUrl}
                    alt=""
                    className="size-24 shrink-0 rounded-[1.35rem] border-4 border-background bg-background object-cover p-1 shadow-lg sm:size-28"
                  />
                ) : (
                  <div className="flex size-24 shrink-0 items-center justify-center rounded-[1.35rem] border-4 border-background bg-background text-violet-600 shadow-lg sm:size-28 dark:text-violet-300">
                    <Building2 className="h-10 w-10" aria-hidden />
                  </div>
                )}
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
                  {profile.clubName}
                </h2>
                {profile.clubTagline ? (
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {profile.clubTagline}
                  </p>
                ) : null}
                {profile.clubAdditionalInfo ? (
                  <p className="mt-3 max-w-xs whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                    {profile.clubAdditionalInfo}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="max-h-[calc(92dvh-18rem)] overflow-y-auto px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
              <ClubProfileBody profile={profile} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
