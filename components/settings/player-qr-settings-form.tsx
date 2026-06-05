"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
} from "@/lib/player-qr-branding-shared";
import { cn } from "@/lib/utils";

type PlayerQrSettingsResponse = {
  playerQrTitle: string;
  defaultBrandName: string;
  maxTitleLength: number;
  previewDataUrl: string;
  message?: string;
};

export function PlayerQrSettingsForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

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
    queryKey: ["player-qr-settings-preview", title],
    queryFn: async () => {
      const response = await fetch(
        `/api/settings/player-qr?previewTitle=${encodeURIComponent(title)}`,
      );
      const payload = (await response.json()) as PlayerQrSettingsResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load preview.");
      return payload.previewDataUrl;
    },
    enabled: Boolean(data),
    staleTime: 300,
  });

  useEffect(() => {
    if (data) setTitle(data.playerQrTitle);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (playerQrTitle: string) => {
      const response = await fetch("/api/settings/player-qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerQrTitle }),
      });
      const payload = (await response.json()) as PlayerQrSettingsResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to save QR settings.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "QR download settings saved.");
      queryClient.setQueryData(["player-qr-settings"], (current: PlayerQrSettingsResponse | undefined) =>
        current
          ? {
              ...current,
              playerQrTitle: payload.playerQrTitle,
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
      <Card className="glass-panel">
        <CardContent className="py-8">
          <p className="text-destructive">
            {error instanceof Error ? error.message : "Failed to load QR settings."}
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}>
            Back to home
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-xl">Player QR download</CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize the title shown at the top of player QR codes for your open plays. Leave blank
          to use the default <span className="font-medium">{DEFAULT_QR_BRAND_NAME}</span> header.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
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
            onChange={(event) => setTitle(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {hasCustomTitle
              ? `${DEFAULT_QR_BRAND_NAME} will appear as a small label below the player name.`
              : `Players will see ${DEFAULT_QR_BRAND_NAME} at the top of the QR.`}
          </p>
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

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={saveMutation.isPending || title === (data?.playerQrTitle ?? "")}
            onClick={() => saveMutation.mutate(trimmedTitle)}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save settings"
            )}
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
            Back to home
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
