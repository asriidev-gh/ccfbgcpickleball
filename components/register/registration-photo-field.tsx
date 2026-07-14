"use client";

import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SimpleTooltip } from "@/components/ui/tooltip";
import {
  compressRegistrationPhoto,
  shouldCompressRegistrationPhoto,
} from "@/lib/compress-registration-photo";
import {
  isAcceptedRegistrationPhotoType,
  MAX_REGISTRATION_PHOTO_BYTES,
} from "@/lib/registration-photo";
import { cn } from "@/lib/utils";

type RegistrationPhotoFieldProps = {
  disabled?: boolean;
  error?: string;
  optional?: boolean;
  currentPhotoUrl?: string | null;
  onChange: (file: File | null) => void;
};

export function RegistrationPhotoField({
  disabled = false,
  error,
  optional = false,
  currentPhotoUrl = null,
  onChange,
}: RegistrationPhotoFieldProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyFile = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!file) {
      setPreviewUrl(null);
      setFileName(null);
      onChange(null);
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    onChange(file);
  };

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

      applyFile(processed);
    } catch (compressError) {
      toast.error(
        compressError instanceof Error
          ? compressError.message
          : "Could not process this photo.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const clearPhoto = () => {
    applyFile(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const inputsDisabled = disabled || processing;
  const displayPhotoUrl = previewUrl ?? (currentPhotoUrl?.trim() || null);

  return (
    <div
      className={cn(
        "register-photo-block space-y-3",
        error && "rounded-lg ring-2 ring-destructive/40",
      )}
    >
      <div>
        <Label className="register-label">
          Your photo{optional ? " (optional)" : " *"}
        </Label>
        <p className="caption mt-1 text-muted-foreground">
          {optional
            ? "Take a selfie or upload a picture. Large camera photos are resized automatically. If you skip this, a random avatar is assigned."
            : "Take a selfie or upload a picture. A photo is required to register. Large camera photos are resized automatically."}
        </p>
      </div>

      {displayPhotoUrl ? (
        <div className="register-photo-preview-wrap">
          <div className="register-photo-preview-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayPhotoUrl} alt="Registration preview" className="register-photo-preview" />
            {fileName ? (
              <div className="absolute right-2 top-2">
                <SimpleTooltip label="Cancel selected upload">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="register-photo-clear-btn"
                    disabled={inputsDisabled}
                    aria-label="Cancel selected upload"
                    onClick={clearPhoto}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              </div>
            ) : null}
          </div>
          {fileName ? (
            <p className="caption min-w-0 truncate text-muted-foreground">{fileName}</p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="register-photo-placeholder"
          disabled={inputsDisabled}
          aria-label={processing ? "Preparing photo" : "Add a photo"}
          onClick={() => cameraInputRef.current?.click()}
        >
          {processing ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground" aria-hidden />
          )}
          <span className="caption text-muted-foreground">
            {processing ? "Preparing photo…" : "No photo selected"}
          </span>
        </button>
      )}

      <div className="register-photo-actions">
        <Button
          type="button"
          variant="outline"
          className="register-photo-btn"
          disabled={inputsDisabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" aria-hidden />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="register-photo-btn"
          disabled={inputsDisabled}
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" aria-hidden />
          Upload photo
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        disabled={inputsDisabled}
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        disabled={inputsDisabled}
        onChange={handleFileChange}
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
