"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClubSettings } from "@/lib/club-settings-shared";
import {
  MAX_CLUB_MISSION_VISION_LENGTH,
  MAX_CLUB_NAME_LENGTH,
  MAX_CLUB_SOCIAL_URL_LENGTH,
  MAX_CLUB_TAGLINE_LENGTH,
  MAX_CLUB_LOGO_BYTES,
} from "@/lib/club-settings-shared";
import {
  compressClubLogo,
  shouldCompressClubLogo,
} from "@/lib/compress-registration-photo";
import {
  isAcceptedRegistrationPhotoType,
} from "@/lib/registration-photo";

type ClubSettingsResponse = ClubSettings & {
  defaultClubName: string;
  logoUploadConfigured: boolean;
  message?: string;
};

export function ClubSettingsTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    clubName: "",
    clubTagline: "",
    clubMissionVision: "",
    clubFacebookUrl: "",
    clubInstagramUrl: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["club-settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings/club");
      const payload = (await response.json()) as ClubSettingsResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to load club settings.");
      return payload;
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      clubName: data.clubName || data.defaultClubName,
      clubTagline: data.clubTagline,
      clubMissionVision: data.clubMissionVision,
      clubFacebookUrl: data.clubFacebookUrl,
      clubInstagramUrl: data.clubInstagramUrl,
    });
    setLogoUrl(data.clubLogoUrl);
    setLogoFile(null);
    setRemoveLogo(false);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(null);
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
      body.append("clubMissionVision", form.clubMissionVision);
      body.append("clubFacebookUrl", form.clubFacebookUrl);
      body.append("clubInstagramUrl", form.clubInstagramUrl);
      if (removeLogo) body.append("removeLogo", "true");
      if (logoFile) body.append("logo", logoFile);

      const response = await fetch("/api/settings/club", { method: "PATCH", body });
      const payload = (await response.json()) as ClubSettingsResponse;
      if (!response.ok) throw new Error(payload.message ?? "Failed to save club settings.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Club settings saved.");
      queryClient.setQueryData(["club-settings"], payload);
      queryClient.invalidateQueries({ queryKey: ["player-qr-settings"] });
      setLogoUrl(payload.clubLogoUrl);
      setLogoFile(null);
      setRemoveLogo(false);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
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
  const hasChanges =
    form.clubName !== savedClubName ||
    form.clubTagline !== (data?.clubTagline ?? "") ||
    form.clubMissionVision !== (data?.clubMissionVision ?? "") ||
    form.clubFacebookUrl !== (data?.clubFacebookUrl ?? "") ||
    form.clubInstagramUrl !== (data?.clubInstagramUrl ?? "") ||
    Boolean(logoFile) ||
    removeLogo;

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading club settings…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load club settings."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="club-name">Club name</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {form.clubName.length}/{MAX_CLUB_NAME_LENGTH}
          </span>
        </div>
        <Input
          id="club-name"
          value={form.clubName}
          maxLength={MAX_CLUB_NAME_LENGTH}
          disabled={saveMutation.isPending}
          onChange={(event) => setForm((prev) => ({ ...prev, clubName: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="club-tagline">Tag line</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {form.clubTagline.length}/{MAX_CLUB_TAGLINE_LENGTH}
          </span>
        </div>
        <Input
          id="club-tagline"
          value={form.clubTagline}
          maxLength={MAX_CLUB_TAGLINE_LENGTH}
          disabled={saveMutation.isPending}
          onChange={(event) => setForm((prev) => ({ ...prev, clubTagline: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="club-mission-vision">Mission and vision</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {form.clubMissionVision.length}/{MAX_CLUB_MISSION_VISION_LENGTH}
          </span>
        </div>
        <Textarea
          id="club-mission-vision"
          value={form.clubMissionVision}
          maxLength={MAX_CLUB_MISSION_VISION_LENGTH}
          rows={5}
          disabled={saveMutation.isPending}
          className="min-h-[8rem] border-border bg-background shadow-sm"
          onChange={(event) =>
            setForm((prev) => ({ ...prev, clubMissionVision: event.target.value }))
          }
        />
      </div>

      <div className="space-y-4 border-t border-border/60 pt-4">
        <div>
          <p className="text-sm font-medium">Social media</p>
          <p className="text-sm text-muted-foreground">
            Optional links shown with your club profile. Paste a full URL or username path.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-facebook-url">Facebook</Label>
          <Input
            id="club-facebook-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={form.clubFacebookUrl}
            maxLength={MAX_CLUB_SOCIAL_URL_LENGTH}
            placeholder="https://facebook.com/yourclub"
            disabled={saveMutation.isPending}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, clubFacebookUrl: event.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-instagram-url">Instagram</Label>
          <Input
            id="club-instagram-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={form.clubInstagramUrl}
            maxLength={MAX_CLUB_SOCIAL_URL_LENGTH}
            placeholder="https://instagram.com/yourclub"
            disabled={saveMutation.isPending}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, clubInstagramUrl: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <Label>Club logo</Label>
        <p className="text-sm text-muted-foreground">
          Upload a square logo for your club (max 2 MB). Larger files are compressed automatically.
          Recommended at least 200×200 px.
        </p>
        {displayLogoUrl ? (
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayLogoUrl}
              alt="Club logo preview"
              className="size-24 rounded-lg border bg-white object-contain p-2"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saveMutation.isPending || processingLogo || !data?.logoUploadConfigured}
                onClick={() => fileInputRef.current?.click()}
              >
                Replace logo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saveMutation.isPending}
                onClick={clearLogoSelection}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending || processingLogo || !data?.logoUploadConfigured}
            onClick={() => fileInputRef.current?.click()}
          >
            {processingLogo ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Processing…
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
                Upload logo
              </>
            )}
          </Button>
        )}
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

      <div className="flex justify-end border-t border-border/60 pt-4">
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
            "Save club settings"
          )}
        </Button>
      </div>
    </div>
  );
}
