"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
} from "@/lib/player-qr-branding-shared";

type PlayerQrSettingsResponse = {
  playerQrTitle: string;
  playerQrIncludeClubLogo: boolean;
  hasClubLogo: boolean;
  defaultBrandName: string;
  maxTitleLength: number;
  previewDataUrl: string;
  message?: string;
};

type SavePayload = {
  playerQrTitle: string;
  playerQrIncludeClubLogo: boolean;
};

export function PlayerQrSettingsPanel() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [includeClubLogo, setIncludeClubLogo] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["player-qr-settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings/player-qr");
      const payload = (await response.json()) as PlayerQrSettingsResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load QR settings.");
      return payload;
    },
  });

  const { data: previewData } = useQuery({
    queryKey: ["player-qr-settings-preview", title, includeClubLogo],
    queryFn: async () => {
      const params = new URLSearchParams({
        previewTitle: title,
        previewIncludeClubLogo: String(includeClubLogo),
      });
      const response = await fetch(`/api/settings/player-qr?${params.toString()}`);
      const payload = (await response.json()) as PlayerQrSettingsResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load preview.");
      return payload.previewDataUrl;
    },
    enabled: Boolean(data),
    staleTime: 300,
  });

  useEffect(() => {
    if (!data) return;
    setTitle(data.playerQrTitle);
    setIncludeClubLogo(data.playerQrIncludeClubLogo);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: SavePayload) => {
      const response = await fetch("/api/settings/player-qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as PlayerQrSettingsResponse & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to save QR settings.");
      return result;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "QR download settings saved.");
      queryClient.setQueryData(["player-qr-settings"], (current: PlayerQrSettingsResponse | undefined) =>
        current
          ? {
              ...current,
              playerQrTitle: payload.playerQrTitle,
              playerQrIncludeClubLogo: payload.playerQrIncludeClubLogo,
              hasClubLogo: payload.hasClubLogo,
              previewDataUrl: payload.previewDataUrl,
            }
          : current,
      );
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (saveError) => {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save QR settings.");
    },
  });

  const previewDataUrl = previewData ?? data?.previewDataUrl ?? "";
  const trimmedTitle = title.trim();
  const hasCustomTitle = trimmedTitle.length > 0;
  const hasChanges =
    title !== (data?.playerQrTitle ?? "") ||
    includeClubLogo !== (data?.playerQrIncludeClubLogo ?? false);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading QR settings…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load QR settings."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Customize the title shown at the top of player QR codes for your open plays. Leave blank
        to use the default <span className="font-medium">{DEFAULT_QR_BRAND_NAME}</span> header.
      </p>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="player-qr-title">QR title</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {title.length}/{MAX_PLAYER_QR_TITLE_LENGTH}
          </span>
        </div>
        <Input
          id="player-qr-title"
          value={title}
          maxLength={MAX_PLAYER_QR_TITLE_LENGTH}
          placeholder={DEFAULT_QR_BRAND_NAME}
          disabled={saveMutation.isPending}
          onChange={(event) => setTitle(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {hasCustomTitle
            ? `${DEFAULT_QR_BRAND_NAME} will appear as a small label below the player name.`
            : `Players will see ${DEFAULT_QR_BRAND_NAME} at the top of the QR.`}
        </p>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <label
          htmlFor="player-qr-include-club-logo"
          className={`flex items-start gap-3 rounded-lg border border-border/70 p-3 ${
            data?.hasClubLogo ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
        >
          <Checkbox
            id="player-qr-include-club-logo"
            checked={includeClubLogo}
            disabled={saveMutation.isPending || !data?.hasClubLogo}
            onCheckedChange={(value) => setIncludeClubLogo(Boolean(value))}
          />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block text-sm font-medium">Add club logo</span>
            <span className="block text-sm text-muted-foreground">
              {data?.hasClubLogo
                ? "Place your club logo in the center of the QR code at 20% of the code size."
                : "Upload a club logo in My Club to enable this option."}
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Preview</p>
        <div className="mx-auto flex w-fit items-center justify-center rounded-xl border bg-white p-3 shadow-sm">
          {previewDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewDataUrl}
              alt="Player QR preview"
              className="block max-w-[min(280px,calc(100vw-4rem))] object-contain"
            />
          ) : (
            <p className="px-4 py-16 text-sm text-muted-foreground">Preview unavailable.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-border/60 pt-4">
        <Button
          type="button"
          disabled={saveMutation.isPending || !hasChanges}
          onClick={() =>
            saveMutation.mutate({
              playerQrTitle: trimmedTitle,
              playerQrIncludeClubLogo: includeClubLogo,
            })
          }
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save QR settings"
          )}
        </Button>
      </div>
    </div>
  );
}
