"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  compressRegistrationPhoto,
  shouldCompressRegistrationPhoto,
} from "@/lib/compress-registration-photo";
import {
  isAcceptedRegistrationPhotoType,
  MAX_REGISTRATION_PHOTO_BYTES,
} from "@/lib/registration-photo";
import { cn } from "@/lib/utils";

export type MarketplaceListingPhotoValue = {
  file: File | null;
  removePhoto: boolean;
};

type MarketplaceListingPhotoFieldProps = {
  disabled?: boolean;
  configured?: boolean;
  currentPhotoUrl?: string | null;
  required?: boolean;
  value: MarketplaceListingPhotoValue;
  onChange: (value: MarketplaceListingPhotoValue) => void;
};

export function MarketplaceListingPhotoField({
  disabled = false,
  configured = true,
  currentPhotoUrl = null,
  required = false,
  value,
  onChange,
}: MarketplaceListingPhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!value.file && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [value.file, previewUrl]);

  const displayPhotoUrl = value.removePhoto
    ? previewUrl
    : previewUrl ?? (currentPhotoUrl?.trim() || null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isAcceptedRegistrationPhotoType(file.type)) {
      toast.error("Please use a JPG, PNG, WebP, or GIF photo.");
      return;
    }

    setProcessing(true);
    try {
      let processed = file;
      if (shouldCompressRegistrationPhoto(file)) {
        processed = await compressRegistrationPhoto(file);
      }

      if (processed.size > MAX_REGISTRATION_PHOTO_BYTES) {
        toast.error("Photo is too large. Try a different picture.");
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(processed));
      onChange({ file: processed, removePhoto: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process this photo.");
    } finally {
      setProcessing(false);
    }
  };

  const clearPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange({
      file: null,
      removePhoto: Boolean(currentPhotoUrl?.trim()),
    });
  };

  const inputsDisabled = disabled || processing || !configured;

  return (
    <div className="space-y-3">
      <div>
        <Label>{required ? "Photo" : "Photo (optional)"}</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {required
            ? "A product photo is required. JPG, PNG, WebP, or GIF up to 5 MB."
            : "Add one product photo. JPG, PNG, WebP, or GIF up to 5 MB."}
        </p>
      </div>

      <button
        type="button"
        disabled={inputsDisabled}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          configured
            ? "border-border/70 bg-muted/15 hover:bg-muted/25"
            : "cursor-not-allowed border-border/50 bg-muted/20 opacity-70",
        )}
      >
        {displayPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayPhotoUrl}
            alt="Listing preview"
            className="max-h-48 w-full rounded-lg border border-border/70 bg-background object-contain"
          />
        ) : (
          <span className="flex size-24 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
            {processing ? (
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-8 w-8 opacity-60" aria-hidden />
            )}
          </span>
        )}
        <span className="text-sm font-medium text-foreground">
          {processing
            ? "Processing photo…"
            : displayPhotoUrl
              ? "Click to replace photo"
              : "Click to upload photo"}
        </span>
      </button>

      {displayPhotoUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={inputsDisabled}
          onClick={clearPhoto}
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Remove photo
        </Button>
      ) : null}

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Photo upload is not configured on this server.
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={inputsDisabled}
        onChange={handleFileChange}
      />
    </div>
  );
}
