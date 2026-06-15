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
import { MAX_MARKETPLACE_PHOTO_BYTES } from "@/lib/marketplace-media-shared";
import {
  isAcceptedRegistrationPhotoType,
  MAX_REGISTRATION_PHOTO_BYTES,
} from "@/lib/registration-photo";
import { cn } from "@/lib/utils";

export type MarketplacePaymentProofValue = {
  file: File | null;
};

type MarketplacePaymentProofFieldProps = {
  disabled?: boolean;
  required?: boolean;
  value: MarketplacePaymentProofValue;
  onChange: (value: MarketplacePaymentProofValue) => void;
};

export function MarketplacePaymentProofField({
  disabled = false,
  required = false,
  value,
  onChange,
}: MarketplacePaymentProofFieldProps) {
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isAcceptedRegistrationPhotoType(file.type)) {
      toast.error("Please use a JPG, PNG, WebP, or GIF image.");
      return;
    }

    setProcessing(true);
    try {
      let processed = file;
      if (shouldCompressRegistrationPhoto(file)) {
        processed = await compressRegistrationPhoto(file);
      }

      const maxBytes = Math.min(MAX_REGISTRATION_PHOTO_BYTES, MAX_MARKETPLACE_PHOTO_BYTES);
      if (processed.size > maxBytes) {
        toast.error("Image is too large. Try a different picture.");
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(processed));
      onChange({ file: processed });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process this image.");
    } finally {
      setProcessing(false);
    }
  };

  const clearProof = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange({ file: null });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>
          Proof of payment
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {required
            ? "Required for GCash and bank transfer. Upload a screenshot or photo of your payment."
            : "Upload a screenshot or photo of your payment."}{" "}
          JPG, PNG, WebP, or GIF up to 5 MB.
        </p>
      </div>

      <button
        type="button"
        disabled={disabled || processing}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          "border-border/70 bg-muted/15 hover:bg-muted/25",
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Payment proof preview"
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
            ? "Processing image…"
            : previewUrl
              ? "Click to replace proof"
              : "Click to upload proof of payment"}
        </span>
      </button>

      {previewUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={disabled || processing}
          onClick={clearProof}
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Remove proof
        </Button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={disabled || processing}
        onChange={handleFileChange}
      />
    </div>
  );
}
