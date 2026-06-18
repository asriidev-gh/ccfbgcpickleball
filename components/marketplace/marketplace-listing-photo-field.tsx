"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import { MAX_MARKETPLACE_LISTING_PHOTOS } from "@/lib/marketplace-listings-shared";
import { createClientKey } from "@/lib/create-client-key";
import { cn } from "@/lib/utils";

export type MarketplaceListingPhotoValue = {
  files: File[];
  fileClientIds: string[];
  removePhoto: boolean;
  keptCurrentPhotoUrls?: string[];
  photoOrder?: string[];
};

type MarketplaceListingPhotoFieldProps = {
  disabled?: boolean;
  configured?: boolean;
  currentPhotoUrls?: string[];
  embedded?: boolean;
  required?: boolean;
  value: MarketplaceListingPhotoValue;
  onChange: (value: MarketplaceListingPhotoValue) => void;
};

function buildDefaultPhotoOrder(existingUrls: string[], fileClientIds: string[]) {
  return [
    ...existingUrls.map((url) => `existing:${url}`),
    ...fileClientIds.map((id) => `new:${id}`),
  ];
}

function reconcilePhotoOrder(photoOrder: string[] | undefined, defaultOrder: string[]) {
  if (!photoOrder || photoOrder.length === 0) return defaultOrder;
  const valid = photoOrder.filter((token) => defaultOrder.includes(token));
  const missing = defaultOrder.filter((token) => !valid.includes(token));
  return [...valid, ...missing];
}

export function createEmptyMarketplaceListingPhotoValue(): MarketplaceListingPhotoValue {
  return {
    files: [],
    fileClientIds: [],
    removePhoto: false,
  };
}

export function createMarketplaceListingPhotoValueFromUrls(urls: string[]): MarketplaceListingPhotoValue {
  const kept = urls.map((url) => url.trim()).filter((url) => url.length > 0);
  return {
    files: [],
    fileClientIds: [],
    removePhoto: false,
    keptCurrentPhotoUrls: kept,
    photoOrder: buildDefaultPhotoOrder(kept, []),
  };
}

type SortablePhotoTileProps = {
  token: string;
  index: number;
  preview: string;
  inputsDisabled: boolean;
  sortable: boolean;
  onRemove: (token: string) => void;
};

function SortablePhotoTile({
  token,
  index,
  preview,
  inputsDisabled,
  sortable,
  onRemove,
}: SortablePhotoTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: token,
    disabled: inputsDisabled || !sortable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-md border bg-background",
        isDragging ? "z-10 border-primary opacity-90 ring-2 ring-primary/30" : "border-border/70",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt={`Photo ${index + 1}`}
        className="aspect-square w-full rounded-md object-cover"
        draggable={false}
      />
      <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {index + 1}
      </span>
      <button
        type="button"
        className="absolute bottom-1 left-1 cursor-grab rounded bg-black/55 p-0.5 text-white opacity-80 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Drag photo ${index + 1}`}
        disabled={inputsDisabled || !sortable}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        className="absolute right-1 top-1 rounded-full bg-black/75 p-1 text-white hover:bg-black/90"
        aria-label={`Remove photo ${index + 1}`}
        disabled={inputsDisabled}
        onClick={() => onRemove(token)}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function MarketplaceListingPhotoField({
  disabled = false,
  configured = true,
  currentPhotoUrls = [],
  embedded = false,
  required = false,
  value,
  onChange,
}: MarketplaceListingPhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const trimmedCurrentUrls = currentPhotoUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  const keptCurrentUrls =
    value.keptCurrentPhotoUrls?.filter((url) => trimmedCurrentUrls.includes(url)) ??
    trimmedCurrentUrls;

  const effectiveCurrentUrls = value.removePhoto
    ? []
    : keptCurrentUrls.filter((url) => trimmedCurrentUrls.includes(url));

  const fileClientIds =
    value.fileClientIds.length === value.files.length
      ? value.fileClientIds
      : value.files.map((_, index) => `new-${index}`);

  const defaultOrder = useMemo(
    () => buildDefaultPhotoOrder(effectiveCurrentUrls, fileClientIds),
    [effectiveCurrentUrls, fileClientIds],
  );

  const orderedTokens = reconcilePhotoOrder(value.photoOrder, defaultOrder);

  const previewUrlsById = useMemo(() => {
    const nextPreviewUrls: Record<string, string> = {};
    for (let index = 0; index < value.files.length; index += 1) {
      const clientId = fileClientIds[index];
      const file = value.files[index];
      if (!clientId || !file) continue;
      nextPreviewUrls[clientId] = URL.createObjectURL(file);
    }
    return nextPreviewUrls;
  }, [value.files, fileClientIds]);

  useEffect(() => {
    return () => {
      for (const previewUrl of Object.values(previewUrlsById)) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrlsById]);

  const emitChange = (next: Partial<MarketplaceListingPhotoValue>) => {
    const files = next.files ?? value.files;
    const nextFileClientIds = next.fileClientIds ?? value.fileClientIds;
    const ids =
      nextFileClientIds.length === files.length
        ? nextFileClientIds
        : files.map((_, index) => `new-${index}`);
    const nextExisting =
      next.keptCurrentPhotoUrls ??
      (next.removePhoto === true ? [] : effectiveCurrentUrls);
    const nextDefaultOrder = buildDefaultPhotoOrder(nextExisting, ids);
    onChange({
      files,
      fileClientIds: ids,
      removePhoto: next.removePhoto ?? value.removePhoto,
      keptCurrentPhotoUrls: nextExisting,
      photoOrder: reconcilePhotoOrder(next.photoOrder ?? value.photoOrder, nextDefaultOrder),
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const totalCount = effectiveCurrentUrls.length + value.files.length + selectedFiles.length;
    if (totalCount > MAX_MARKETPLACE_LISTING_PHOTOS) {
      toast.error(`You can upload up to ${MAX_MARKETPLACE_LISTING_PHOTOS} photos per listing.`);
      return;
    }

    for (const file of selectedFiles) {
      if (!isAcceptedRegistrationPhotoType(file.type)) {
        toast.error("Please use JPG, PNG, WebP, or GIF photos.");
        return;
      }
    }

    setProcessing(true);
    try {
      const processedFiles: File[] = [];
      for (const file of selectedFiles) {
        let processed = file;
        if (shouldCompressRegistrationPhoto(file)) {
          processed = await compressRegistrationPhoto(file);
        }

        if (processed.size > MAX_REGISTRATION_PHOTO_BYTES) {
          toast.error("One or more photos are too large. Try a different picture.");
          return;
        }
        processedFiles.push(processed);
      }

      const nextIds = processedFiles.map(() => createClientKey());
      const nextFiles = [...value.files, ...processedFiles];
      const nextClientIds = [...fileClientIds, ...nextIds];
      emitChange({
        files: nextFiles,
        fileClientIds: nextClientIds,
        removePhoto: false,
        keptCurrentPhotoUrls: effectiveCurrentUrls,
        photoOrder: [
          ...orderedTokens,
          ...nextIds.map((id) => `new:${id}`),
        ],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process this photo.");
    } finally {
      setProcessing(false);
    }
  };

  const removeToken = (token: string) => {
    if (token.startsWith("existing:")) {
      const url = token.slice("existing:".length);
      const nextKept = effectiveCurrentUrls.filter((item) => item !== url);
      emitChange({
        keptCurrentPhotoUrls: nextKept,
        removePhoto: nextKept.length === 0 && value.files.length === 0,
        photoOrder: orderedTokens.filter((item) => item !== token),
      });
      return;
    }

    const clientId = token.slice("new:".length);
    const removeIndex = fileClientIds.indexOf(clientId);
    if (removeIndex < 0) return;
    const nextFiles = value.files.filter((_, index) => index !== removeIndex);
    const nextClientIds = fileClientIds.filter((id) => id !== clientId);
    emitChange({
      files: nextFiles,
      fileClientIds: nextClientIds,
      removePhoto: effectiveCurrentUrls.length === 0 && nextFiles.length === 0,
      photoOrder: orderedTokens.filter((item) => item !== token),
    });
  };

  const resetOrder = () => {
    emitChange({ photoOrder: defaultOrder });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedTokens.indexOf(String(active.id));
    const newIndex = orderedTokens.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    emitChange({ photoOrder: arrayMove(orderedTokens, oldIndex, newIndex) });
  };

  const resolvePreview = (token: string) => {
    if (token.startsWith("existing:")) {
      return token.slice("existing:".length);
    }
    const clientId = token.slice("new:".length);
    return previewUrlsById[clientId] ?? null;
  };

  const inputsDisabled = disabled || processing || !configured;
  const slotsUsed = orderedTokens.length;
  const slotsLeft = Math.max(0, MAX_MARKETPLACE_LISTING_PHOTOS - slotsUsed);
  const canAddMore = slotsLeft > 0;
  const canReorder = orderedTokens.length > 1 && !inputsDisabled;

  return (
    <div className="space-y-3">
      {embedded ? null : (
        <div>
          <Label>{required ? "Photos" : "Photos (optional)"}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload 1 to {MAX_MARKETPLACE_LISTING_PHOTOS} photos. Use the grip icon to drag and set
            order. JPG, PNG, WebP, or GIF up to 5 MB each.
          </p>
        </div>
      )}

      {orderedTokens.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {slotsUsed} photo{slotsUsed === 1 ? "" : "s"} · drag to reorder
            </p>
            {orderedTokens.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={inputsDisabled}
                onClick={resetOrder}
              >
                <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
                Reset order
              </Button>
            ) : null}
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedTokens} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {orderedTokens.map((token, index) => {
                  const preview = resolvePreview(token);
                  if (!preview) return null;
                  return (
                    <SortablePhotoTile
                      key={token}
                      token={token}
                      index={index}
                      preview={preview}
                      inputsDisabled={inputsDisabled}
                      sortable={canReorder}
                      onRemove={removeToken}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <button
        type="button"
        disabled={inputsDisabled || !canAddMore}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          configured && canAddMore
            ? "border-border/70 bg-muted/15 hover:bg-muted/25"
            : "cursor-not-allowed border-border/50 bg-muted/20 opacity-70",
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
          {processing ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-7 w-7 opacity-60" aria-hidden />
          )}
        </span>
        <span className="text-sm font-medium text-foreground">
          {processing
            ? "Processing photos…"
            : canAddMore
              ? orderedTokens.length > 0
                ? "Add more photos"
                : "Upload photos"
              : "Photo limit reached"}
        </span>
      </button>

      <p className="text-xs text-muted-foreground">
        {slotsLeft} of {MAX_MARKETPLACE_LISTING_PHOTOS} photo slots available.
      </p>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Photo upload is not configured on this server.
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={inputsDisabled || !canAddMore}
        onChange={handleFileChange}
      />
    </div>
  );
}
