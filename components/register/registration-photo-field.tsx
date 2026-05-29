"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type RegistrationPhotoFieldProps = {
  disabled?: boolean;
  error?: string;
  onChange: (file: File | null) => void;
};

export function RegistrationPhotoField({
  disabled = false,
  error,
  onChange,
}: RegistrationPhotoFieldProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

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

    if (!ACCEPTED_TYPES.includes(file.type)) {
      onChange(null);
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    onChange(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please use a JPG, PNG, WebP, or GIF photo.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    applyFile(file);
    event.target.value = "";
  };

  const clearPhoto = () => {
    applyFile(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  return (
    <div
      className={cn(
        "register-photo-block space-y-3",
        error && "rounded-lg ring-2 ring-destructive/40",
      )}
    >
      <div>
        <Label className="register-label">Your photo</Label>
        <p className="caption mt-1 text-muted-foreground">
          Take a selfie or upload a picture (optional, max 5 MB). If you skip this, a random avatar is assigned.
        </p>
      </div>

      {previewUrl ? (
        <div className="register-photo-preview-wrap">
          <div className="register-photo-preview-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Registration preview" className="register-photo-preview" />
          </div>
          {fileName ? (
            <p className="caption min-w-0 truncate text-muted-foreground">{fileName}</p>
          ) : null}
        </div>
      ) : (
        <div className="register-photo-placeholder" aria-hidden>
          <Camera className="h-8 w-8 text-muted-foreground" />
          <span className="caption text-muted-foreground">No photo selected</span>
        </div>
      )}

      <div className="register-photo-actions flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="register-photo-btn flex-1"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="register-photo-btn flex-1"
          disabled={disabled}
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Upload photo
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={disabled}
            aria-label="Remove photo"
            onClick={clearPhoto}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
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
