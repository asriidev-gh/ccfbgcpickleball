"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ImagePlus,
  Link2,
  Loader2,
  MapPin,
  Megaphone,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ClubOrganizersField, organizersFormEquals, organizersFromSaved, serializeOrganizersForSave, type ClubOrganizerFormEntry } from "@/components/settings/club-organizers-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClubSettings } from "@/lib/club-settings-shared";
import {
  MAX_CLUB_ADDRESS_LENGTH,
  MAX_CLUB_ADDITIONAL_INFO_LENGTH,
  MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH,
  MAX_CLUB_MISSION_VISION_LENGTH,
  MAX_CLUB_NAME_LENGTH,
  MAX_CLUB_SOCIAL_URL_LENGTH,
  MAX_CLUB_TAGLINE_LENGTH,
  MAX_CLUB_LOGO_BYTES,
  normalizeClubGoogleMapEmbedUrl,
} from "@/lib/club-settings-shared";
import {
  compressClubLogo,
  shouldCompressClubLogo,
} from "@/lib/compress-registration-photo";
import { isAcceptedRegistrationPhotoType } from "@/lib/registration-photo";
import { cn } from "@/lib/utils";

type ClubSettingsResponse = ClubSettings & {
  defaultClubName: string;
  logoUploadConfigured: boolean;
  message?: string;
};

type ClubFormState = {
  clubName: string;
  clubTagline: string;
  clubAdditionalInfo: string;
  clubMissionVision: string;
  clubFacebookUrl: string;
  clubInstagramUrl: string;
  clubAddress: string;
  clubGoogleMapEmbedUrl: string;
};

function CharCount({ value, max }: { value: number; max: number }) {
  const ratio = value / max;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        ratio >= 0.9 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      {value}/{max}
    </span>
  );
}

function ClubProfileSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "club-profile-section rounded-2xl border border-border/70 bg-muted/10 p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="club-profile-section__icon flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({
  htmlFor,
  label,
  count,
}: {
  htmlFor: string;
  label: string;
  count?: { value: number; max: number };
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {count ? <CharCount value={count.value} max={count.max} /> : null}
    </div>
  );
}

const clubProfileSurfaceClass = "club-profile-surface";

function GoogleMapEmbedDialog({
  open,
  onOpenChange,
  initialValue,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string;
  onSave: (embedUrl: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(initialValue);
      setError("");
    }
  }, [open, initialValue]);

  const previewUrl = normalizeClubGoogleMapEmbedUrl(draft);

  const handleSave = () => {
    const normalized = normalizeClubGoogleMapEmbedUrl(draft);
    if (!draft.trim()) {
      setError("Paste a Google Maps embed link or iframe code.");
      return;
    }
    if (!normalized) {
      setError("Use a Google Maps embed link (Share → Embed a map → copy HTML).");
      return;
    }
    onSave(normalized);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-5 overflow-y-auto p-5 sm:max-w-4xl sm:p-6 lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Add Google Map</DialogTitle>
          <DialogDescription>
            In Google Maps, open your location → Share → Embed a map → copy the HTML, then paste it
            below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="club-google-map-embed">Embed link or iframe HTML</Label>
            <Textarea
              id="club-google-map-embed"
              value={draft}
              maxLength={MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH}
              rows={6}
              placeholder={'<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>'}
              className={cn(
                "club-profile-field club-profile-surface min-h-[8rem] resize-y",
                error && "border-destructive",
              )}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {previewUrl ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <div className="aspect-[16/10] min-h-[18rem] overflow-hidden rounded-xl border border-border/70 bg-muted/20 sm:min-h-[22rem]">
                <iframe
                  src={previewUrl}
                  title="Google Map preview"
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClubSettingsTab({ hideLivePreview = false }: { hideLivePreview?: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ClubFormState>({
    clubName: "",
    clubTagline: "",
    clubAdditionalInfo: "",
    clubMissionVision: "",
    clubFacebookUrl: "",
    clubInstagramUrl: "",
    clubAddress: "",
    clubGoogleMapEmbedUrl: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [organizers, setOrganizers] = useState<ClubOrganizerFormEntry[]>(organizersFromSaved([]));

  const { data, isLoading, error } = useQuery({
    queryKey: ["club-settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings/club");
      const payload = (await response.json()) as ClubSettingsResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to load club settings.");
      return payload;
    },
  });

  const applySavedData = (saved: ClubSettingsResponse) => {
    setForm({
      clubName: saved.clubName || saved.defaultClubName,
      clubTagline: saved.clubTagline,
      clubAdditionalInfo: saved.clubAdditionalInfo,
      clubMissionVision: saved.clubMissionVision,
      clubFacebookUrl: saved.clubFacebookUrl,
      clubInstagramUrl: saved.clubInstagramUrl,
      clubAddress: saved.clubAddress,
      clubGoogleMapEmbedUrl: saved.clubGoogleMapEmbedUrl,
    });
    setLogoUrl(saved.clubLogoUrl);
    setLogoFile(null);
    setRemoveLogo(false);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(null);
    organizers.forEach((entry) => {
      if (entry.photoPreviewUrl) URL.revokeObjectURL(entry.photoPreviewUrl);
    });
    setOrganizers(organizersFromSaved(saved.clubOrganizers ?? []));
  };

  useEffect(() => {
    if (!data) return;
    applySavedData(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.append("clubName", form.clubName);
      body.append("clubTagline", form.clubTagline);
      body.append("clubAdditionalInfo", form.clubAdditionalInfo);
      body.append("clubMissionVision", form.clubMissionVision);
      body.append("clubFacebookUrl", form.clubFacebookUrl);
      body.append("clubInstagramUrl", form.clubInstagramUrl);
      body.append("clubAddress", form.clubAddress);
      body.append("clubGoogleMapEmbedUrl", form.clubGoogleMapEmbedUrl);
      if (removeLogo) body.append("removeLogo", "true");
      if (logoFile) body.append("logo", logoFile);

      const organizersToSave = organizers.filter(
        (entry) => entry.name.trim() || entry.photoUrl || entry.photoFile,
      );
      if (organizersToSave.some((entry) => !entry.name.trim())) {
        throw new Error("Each organizer needs a name.");
      }

      body.append("clubOrganizers", JSON.stringify(serializeOrganizersForSave(organizersToSave)));
      organizersToSave.forEach((entry, index) => {
        if (entry.photoFile) {
          body.append(`organizerPhoto_${index}`, entry.photoFile);
        }
      });

      const response = await fetch("/api/settings/club", { method: "PATCH", body });
      const payload = (await response.json()) as ClubSettingsResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to save club settings.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Club profile saved.");
      queryClient.setQueryData(["club-settings"], payload);
      queryClient.invalidateQueries({ queryKey: ["player-qr-settings"] });
      queryClient.invalidateQueries({ queryKey: ["club-settings"] });
      setLogoUrl(payload.clubLogoUrl);
      setLogoFile(null);
      setRemoveLogo(false);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
      organizers.forEach((entry) => {
        if (entry.photoPreviewUrl) URL.revokeObjectURL(entry.photoPreviewUrl);
      });
      setOrganizers(organizersFromSaved(payload.clubOrganizers ?? []));
    },
    onError: (saveError) => {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save club settings.");
    },
  });

  const handleLogoChange = async (file: File | null) => {
    if (!file) return;

    if (!isAcceptedRegistrationPhotoType(file.type)) {
      toast.error("Please use a JPG, PNG, WebP, or GIF image.");
      return;
    }

    setProcessingLogo(true);
    try {
      let processed = file;
      if (shouldCompressClubLogo(file)) {
        processed = await compressClubLogo(file);
        toast.info("Logo was compressed to fit the 2 MB limit.");
      }
      if (processed.size > MAX_CLUB_LOGO_BYTES) {
        toast.error("Logo is too large. Try a smaller image.");
        return;
      }

      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(URL.createObjectURL(processed));
      setLogoFile(processed);
      setRemoveLogo(false);
    } finally {
      setProcessingLogo(false);
    }
  };

  const clearLogoSelection = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(null);
    setLogoFile(null);
    if (logoUrl) {
      setRemoveLogo(true);
    }
  };

  const savedClubName = data?.clubName || data?.defaultClubName || "";
  const displayLogoUrl = removeLogo ? "" : logoPreviewUrl ?? logoUrl;
  const previewName = form.clubName.trim() || savedClubName || "Your club";
  const previewTagline = form.clubTagline.trim();
  const hasChanges =
    form.clubName !== savedClubName ||
    form.clubTagline !== (data?.clubTagline ?? "") ||
    form.clubAdditionalInfo !== (data?.clubAdditionalInfo ?? "") ||
    form.clubMissionVision !== (data?.clubMissionVision ?? "") ||
    form.clubFacebookUrl !== (data?.clubFacebookUrl ?? "") ||
    form.clubInstagramUrl !== (data?.clubInstagramUrl ?? "") ||
    form.clubAddress !== (data?.clubAddress ?? "") ||
    form.clubGoogleMapEmbedUrl !== (data?.clubGoogleMapEmbedUrl ?? "") ||
    Boolean(logoFile) ||
    removeLogo ||
    !organizersFormEquals(organizers, data?.clubOrganizers ?? []);

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading club profile…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load club profile."}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "club-profile-form space-y-6",
        hideLivePreview && "club-profile-form--embedded",
      )}
    >
      {hideLivePreview ? (
        <div className="club-profile-form__intro border-b border-border/60 pb-4">
          <p className="text-sm font-semibold text-foreground">Club Profile</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Update your club name, logo, mission, and social links shown across the app.
          </p>
        </div>
      ) : null}

      {!hideLivePreview ? (
      <div className="club-profile-preview rounded-2xl border border-border/70 bg-gradient-to-br from-sky-500/8 via-background to-violet-500/5 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Live preview
        </div>
        <div className="flex items-center gap-4">
          {displayLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogoUrl}
              alt=""
              className="size-16 shrink-0 rounded-2xl border border-border/70 bg-background object-cover p-1 shadow-sm"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/80 text-muted-foreground">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{previewName}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {previewTagline || "Add a tagline to describe your club at a glance."}
            </p>
          </div>
        </div>
      </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <ClubProfileSection
          title="Club logo"
          description="Shown in the dashboard header, My Club page, and optional QR branding."
          icon={ImagePlus}
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <button
              type="button"
              disabled={saveMutation.isPending || processingLogo || !data?.logoUploadConfigured}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "club-profile-logo-zone group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                data?.logoUploadConfigured
                  ? clubProfileSurfaceClass
                  : "cursor-not-allowed border-border/50 bg-muted/20 opacity-70",
              )}
            >
              {displayLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayLogoUrl}
                  alt="Club logo preview"
                  className="size-28 rounded-2xl border border-border/70 bg-white object-contain p-2 shadow-sm"
                />
              ) : (
                <span className="flex size-28 items-center justify-center rounded-2xl border border-border/60 bg-muted/30 text-muted-foreground">
                  <ImagePlus className="h-10 w-10 opacity-60" aria-hidden />
                </span>
              )}
              <span className="text-sm font-medium text-foreground">
                {processingLogo
                  ? "Processing image…"
                  : displayLogoUrl
                    ? "Click to replace logo"
                    : "Click to upload logo"}
              </span>
              <span className="max-w-xs text-xs text-muted-foreground">
                Square image, at least 200×200 px. JPG, PNG, WebP, or GIF up to 2 MB.
              </span>
            </button>

            {displayLogoUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={saveMutation.isPending}
                onClick={clearLogoSelection}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Remove logo
              </Button>
            ) : null}

            {!data?.logoUploadConfigured ? (
              <p className="text-sm text-muted-foreground">
                Logo upload is not configured on this server.
              </p>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void handleLogoChange(file);
              }}
            />
          </div>
        </ClubProfileSection>

        <div className="space-y-6 lg:col-span-3">
          <ClubProfileSection
            title="Basic information"
            description="How your club is named across the app."
            icon={Building2}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel
                  htmlFor="club-name"
                  label="Club name"
                  count={{ value: form.clubName.length, max: MAX_CLUB_NAME_LENGTH }}
                />
                <Input
                  id="club-name"
                  value={form.clubName}
                  maxLength={MAX_CLUB_NAME_LENGTH}
                  placeholder="e.g. CCF Pickleball Club"
                  disabled={saveMutation.isPending}
                  className="club-profile-field club-profile-surface h-11"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, clubName: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel
                  htmlFor="club-tagline"
                  label="Tag line"
                  count={{ value: form.clubTagline.length, max: MAX_CLUB_TAGLINE_LENGTH }}
                />
                <Input
                  id="club-tagline"
                  value={form.clubTagline}
                  maxLength={MAX_CLUB_TAGLINE_LENGTH}
                  placeholder="A short phrase members will recognize"
                  disabled={saveMutation.isPending}
                  className="club-profile-field club-profile-surface h-11"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, clubTagline: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel
                  htmlFor="club-additional-info"
                  label="Additional info (optional)"
                  count={{
                    value: form.clubAdditionalInfo.length,
                    max: MAX_CLUB_ADDITIONAL_INFO_LENGTH,
                  }}
                />
                <Textarea
                  id="club-additional-info"
                  value={form.clubAdditionalInfo}
                  maxLength={MAX_CLUB_ADDITIONAL_INFO_LENGTH}
                  rows={3}
                  placeholder="Extra details you'd like members to know…"
                  disabled={saveMutation.isPending}
                  className="club-profile-field club-profile-surface min-h-[5.5rem] resize-y"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, clubAdditionalInfo: event.target.value }))
                  }
                />
              </div>

              <ClubOrganizersField
                organizers={organizers}
                disabled={saveMutation.isPending}
                uploadConfigured={Boolean(data?.logoUploadConfigured)}
                onChange={setOrganizers}
              />
            </div>
          </ClubProfileSection>

          <ClubProfileSection
            title="Mission & vision"
            description="Share what your club stands for — optional but helpful for new members."
            icon={Megaphone}
          >
            <div className="space-y-2">
              <FieldLabel
                htmlFor="club-mission-vision"
                label="Mission and vision"
                count={{
                  value: form.clubMissionVision.length,
                  max: MAX_CLUB_MISSION_VISION_LENGTH,
                }}
              />
              <Textarea
                id="club-mission-vision"
                value={form.clubMissionVision}
                maxLength={MAX_CLUB_MISSION_VISION_LENGTH}
                rows={6}
                placeholder="Describe your club's purpose, values, and goals…"
                disabled={saveMutation.isPending}
                className="club-profile-field club-profile-surface min-h-[9rem] resize-y"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, clubMissionVision: event.target.value }))
                }
              />
            </div>
          </ClubProfileSection>

          <ClubProfileSection
            title="Social links"
            description="Optional links for your club's online presence."
            icon={Share2}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="club-facebook-url" className="text-sm font-medium">
                  Facebook
                </Label>
                <div className="relative">
                  <Link2
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="club-facebook-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={form.clubFacebookUrl}
                    maxLength={MAX_CLUB_SOCIAL_URL_LENGTH}
                    placeholder="facebook.com/yourclub"
                    disabled={saveMutation.isPending}
                    className="club-profile-field club-profile-surface h-11 pl-10"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, clubFacebookUrl: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="club-instagram-url" className="text-sm font-medium">
                  Instagram
                </Label>
                <div className="relative">
                  <Link2
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="club-instagram-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={form.clubInstagramUrl}
                    maxLength={MAX_CLUB_SOCIAL_URL_LENGTH}
                    placeholder="instagram.com/yourclub"
                    disabled={saveMutation.isPending}
                    className="club-profile-field club-profile-surface h-11 pl-10"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, clubInstagramUrl: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </ClubProfileSection>

          <ClubProfileSection
            title="Location"
            description="Optional address and map for players to find your club."
            icon={MapPin}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel
                  htmlFor="club-address"
                  label="Address"
                  count={{ value: form.clubAddress.length, max: MAX_CLUB_ADDRESS_LENGTH }}
                />
                <Textarea
                  id="club-address"
                  value={form.clubAddress}
                  maxLength={MAX_CLUB_ADDRESS_LENGTH}
                  rows={3}
                  placeholder="Street, city, venue name, or directions…"
                  disabled={saveMutation.isPending}
                  className="club-profile-field club-profile-surface min-h-[5.5rem] resize-y"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, clubAddress: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Google Map</Label>
                {form.clubGoogleMapEmbedUrl ? (
                  <div className="space-y-3">
                    <div className="aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                      <iframe
                        src={form.clubGoogleMapEmbedUrl}
                        title="Club location map"
                        className="h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saveMutation.isPending}
                        onClick={() => setMapDialogOpen(true)}
                      >
                        Change map
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={saveMutation.isPending}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, clubGoogleMapEmbedUrl: "" }))
                        }
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                        Remove map
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full border-dashed sm:w-auto"
                    disabled={saveMutation.isPending}
                    onClick={() => setMapDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    Add Google Map
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Embed a map from Google Maps so members can see where you meet.
                </p>
              </div>
            </div>
          </ClubProfileSection>
        </div>
      </div>

      <GoogleMapEmbedDialog
        open={mapDialogOpen}
        onOpenChange={setMapDialogOpen}
        initialValue={form.clubGoogleMapEmbedUrl}
        onSave={(embedUrl) =>
          setForm((prev) => ({ ...prev, clubGoogleMapEmbedUrl: embedUrl }))
        }
      />

      <div
        className={cn(
          "club-profile-save-bar sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between",
          hasChanges
            ? "border-sky-500/30 bg-card/95 backdrop-blur-md"
            : "border-border/60 bg-muted/20",
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          {hasChanges ? (
            <>
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-900 dark:text-amber-100">
                Unsaved changes
              </Badge>
              <span className="text-muted-foreground">Save to update your club profile everywhere.</span>
            </>
          ) : (
            <span className="text-muted-foreground">Your club profile is up to date.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending || !hasChanges}
            onClick={() => data && applySavedData(data)}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            Discard
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending || !hasChanges}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save club profile"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
