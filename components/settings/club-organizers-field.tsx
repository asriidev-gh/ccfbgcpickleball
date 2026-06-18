"use client";

import { ImagePlus, Plus, Trash2, UserRound } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_CLUB_LOGO_BYTES,
  MAX_CLUB_ORGANIZER_NAME_LENGTH,
  MAX_CLUB_ORGANIZERS,
} from "@/lib/club-settings-shared";
import {
  compressClubLogo,
  shouldCompressClubLogo,
} from "@/lib/compress-registration-photo";
import { isAcceptedRegistrationPhotoType } from "@/lib/registration-photo";
import { createClientKey } from "@/lib/create-client-key";
import { cn } from "@/lib/utils";

export type ClubOrganizerFormEntry = {
  id: string;
  name: string;
  photoUrl: string;
  photoPublicId: string;
  photoFile: File | null;
  photoPreviewUrl: string | null;
  removePhoto: boolean;
};

export function createEmptyOrganizerEntry(): ClubOrganizerFormEntry {
  return {
    id: createClientKey(),
    name: "",
    photoUrl: "",
    photoPublicId: "",
    photoFile: null,
    photoPreviewUrl: null,
    removePhoto: false,
  };
}

export function organizersFromSaved(
  saved: { name: string; photoUrl: string; photoPublicId?: string }[],
): ClubOrganizerFormEntry[] {
  if (saved.length === 0) {
    return [createEmptyOrganizerEntry()];
  }

  return saved.map((entry) => ({
    id: createClientKey(),
    name: entry.name,
    photoUrl: entry.photoUrl,
    photoPublicId: entry.photoPublicId ?? "",
    photoFile: null,
    photoPreviewUrl: null,
    removePhoto: false,
  }));
}

export function serializeOrganizersForSave(entries: ClubOrganizerFormEntry[]) {
  return entries
    .filter((entry) => entry.name.trim())
    .map((entry) => ({
      name: entry.name.trim(),
      photoUrl: entry.removePhoto ? "" : entry.photoUrl,
      photoPublicId: entry.removePhoto ? "" : entry.photoPublicId,
      removePhoto: entry.removePhoto,
    }));
}

export function organizersFormEquals(
  current: ClubOrganizerFormEntry[],
  saved: { name: string; photoUrl: string; photoPublicId?: string }[],
) {
  if (current.some((entry) => entry.photoFile || entry.removePhoto)) {
    return false;
  }

  const currentSerialized = serializeOrganizersForSave(current);
  const savedSerialized = saved.map((entry) => ({
    name: entry.name.trim(),
    photoUrl: entry.photoUrl.trim(),
    photoPublicId: entry.photoPublicId ?? "",
    removePhoto: false,
  }));

  return JSON.stringify(currentSerialized) === JSON.stringify(savedSerialized);
}

function OrganizerPhotoField({
  entry,
  index,
  disabled,
  uploadConfigured,
  onPhotoChange,
  onPhotoRemove,
}: {
  entry: ClubOrganizerFormEntry;
  index: number;
  disabled: boolean;
  uploadConfigured: boolean;
  onPhotoChange: (file: File) => void;
  onPhotoRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayPhotoUrl = entry.removePhoto
    ? ""
    : entry.photoPreviewUrl ?? entry.photoUrl;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Photo</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || !uploadConfigured}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors",
            uploadConfigured
              ? "club-profile-surface hover:border-sky-500/40"
              : "cursor-not-allowed border-border/50 bg-muted/20 opacity-70",
          )}
        >
          {displayPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayPhotoUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <UserRound className="h-7 w-7 text-muted-foreground/70" aria-hidden />
          )}
        </button>
        <div className="flex min-w-0 flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !uploadConfigured}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />
            {displayPhotoUrl ? "Change photo" : "Add photo"}
          </Button>
          {displayPhotoUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 justify-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disabled}
              onClick={onPhotoRemove}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPhotoChange(file);
        }}
      />
      {!uploadConfigured ? (
        <p className="text-xs text-muted-foreground">Photo upload is not configured on this server.</p>
      ) : (
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or GIF up to 2 MB.</p>
      )}
      <span className="sr-only">Organizer {index + 1} photo</span>
    </div>
  );
}

export function ClubOrganizersField({
  organizers,
  disabled,
  uploadConfigured,
  onChange,
}: {
  organizers: ClubOrganizerFormEntry[];
  disabled: boolean;
  uploadConfigured: boolean;
  onChange: (next: ClubOrganizerFormEntry[]) => void;
}) {
  const updateEntry = (id: string, patch: Partial<ClubOrganizerFormEntry>) => {
    onChange(organizers.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeEntry = (id: string) => {
    const entry = organizers.find((item) => item.id === id);
    if (entry?.photoPreviewUrl) URL.revokeObjectURL(entry.photoPreviewUrl);
    const next = organizers.filter((item) => item.id !== id);
    onChange(next.length > 0 ? next : [createEmptyOrganizerEntry()]);
  };

  const handlePhotoChange = async (id: string, file: File) => {
    if (!isAcceptedRegistrationPhotoType(file.type)) {
      toast.error("Please use a JPG, PNG, WebP, or GIF image.");
      return;
    }

    let processed = file;
    if (shouldCompressClubLogo(file)) {
      processed = await compressClubLogo(file);
      toast.info("Photo was compressed to fit the 2 MB limit.");
    }
    if (processed.size > MAX_CLUB_LOGO_BYTES) {
      toast.error("Photo is too large. Try a smaller image.");
      return;
    }

    const entry = organizers.find((item) => item.id === id);
    if (entry?.photoPreviewUrl) URL.revokeObjectURL(entry.photoPreviewUrl);

    updateEntry(id, {
      photoFile: processed,
      photoPreviewUrl: URL.createObjectURL(processed),
      removePhoto: false,
    });
  };

  const handlePhotoRemove = (id: string) => {
    const entry = organizers.find((item) => item.id === id);
    if (entry?.photoPreviewUrl) URL.revokeObjectURL(entry.photoPreviewUrl);
    updateEntry(id, {
      photoFile: null,
      photoPreviewUrl: null,
      removePhoto: true,
    });
  };

  const visibleCount = organizers.length;
  const canAddMore = visibleCount < MAX_CLUB_ORGANIZERS;

  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      <div>
        <p className="text-sm font-medium text-foreground">Organizers</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Add up to {MAX_CLUB_ORGANIZERS} organizers with a name and photo.
        </p>
      </div>

      <div className="space-y-4">
        {organizers.map((entry, index) => (
          <div
            key={entry.id}
            className="rounded-xl border border-border/70 bg-background/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Organizer {index + 1}
              </p>
              {organizers.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={disabled}
                  onClick={() => removeEntry(entry.id)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <Label htmlFor={`club-organizer-name-${entry.id}`} className="text-sm font-medium">
                    Name
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {entry.name.length}/{MAX_CLUB_ORGANIZER_NAME_LENGTH}
                  </span>
                </div>
                <Input
                  id={`club-organizer-name-${entry.id}`}
                  value={entry.name}
                  maxLength={MAX_CLUB_ORGANIZER_NAME_LENGTH}
                  placeholder="Organizer name"
                  disabled={disabled}
                  className="club-profile-field club-profile-surface h-11"
                  onChange={(event) => updateEntry(entry.id, { name: event.target.value })}
                />
              </div>

              <OrganizerPhotoField
                entry={entry}
                index={index}
                disabled={disabled}
                uploadConfigured={uploadConfigured}
                onPhotoChange={(file) => void handlePhotoChange(entry.id, file)}
                onPhotoRemove={() => handlePhotoRemove(entry.id)}
              />
            </div>
          </div>
        ))}
      </div>

      {canAddMore ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-dashed sm:w-auto"
          disabled={disabled}
          onClick={() => onChange([...organizers, createEmptyOrganizerEntry()])}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add organizer
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Maximum of {MAX_CLUB_ORGANIZERS} organizers reached.
        </p>
      )}
    </div>
  );
}
