"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function buildGalleryImages(photoUrls: string[] | undefined, photoUrl: string | null | undefined) {
  const images: string[] = [];
  const seen = new Set<string>();

  for (const item of photoUrls ?? []) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    images.push(normalized);
  }

  if (images.length === 0) {
    const fallback = photoUrl?.trim();
    if (fallback) images.push(fallback);
  }

  return images;
}

export function MarketplaceListingPhotoDialog({
  photoUrl,
  photoUrls,
  title,
  open,
  onOpenChange,
}: {
  photoUrl?: string | null;
  photoUrls?: string[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const images = useMemo(
    () => buildGalleryImages(photoUrls, photoUrl),
    [photoUrl, photoUrls],
  );
  const imagesKey = images.join("\0");

  const [index, setIndex] = useState(0);
  const [loadedUrls, setLoadedUrls] = useState<Record<string, boolean>>({});
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setIndex(0);
      setLoadedUrls({});
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || images.length === 0) return;

    for (const url of images) {
      const preload = new window.Image();
      preload.decoding = "async";
      preload.src = url;
      if (preload.complete) {
        setLoadedUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      } else {
        preload.onload = () => {
          setLoadedUrls((prev) => ({ ...prev, [url]: true }));
        };
      }
    }
  }, [open, imagesKey, images]);

  const goPrevious = useCallback(() => {
    if (images.length <= 1) return;
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goNext, goPrevious]);

  const activeUrl = images[index] ?? null;
  const activeLoaded = activeUrl ? loadedUrls[activeUrl] === true : false;

  const handleNavPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,48rem)] gap-3 border-border p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {images.length > 0 ? (
          <>
            <div className="relative grid min-h-[12rem] w-full place-items-center overflow-hidden rounded-lg bg-muted/40 p-2">
              {images.map((url, imageIndex) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`${title} — photo ${imageIndex + 1}`}
                  decoding="async"
                  loading="eager"
                  onLoad={() => {
                    setLoadedUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
                  }}
                  className={cn(
                    "col-start-1 row-start-1 max-h-[min(90vh,1200px)] w-auto max-w-full object-contain transition-opacity duration-150",
                    imageIndex === index
                      ? "z-10 opacity-100"
                      : "pointer-events-none opacity-0",
                  )}
                  aria-hidden={imageIndex !== index}
                />
              ))}

              {activeUrl && !activeLoaded ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : null}

              {images.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 z-30 h-8 w-8 -translate-y-1/2"
                    onPointerDown={handleNavPointerDown}
                    onClick={goPrevious}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 z-30 h-8 w-8 -translate-y-1/2"
                    onPointerDown={handleNavPointerDown}
                    onClick={goNext}
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <>
                <p className="text-center text-xs text-muted-foreground">
                  {index + 1} / {images.length}
                </p>
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                  {images.map((url, thumbIndex) => (
                    <button
                      key={url}
                      type="button"
                      className="rounded-md outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setIndex(thumbIndex)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Thumbnail ${thumbIndex + 1}`}
                        className={cn(
                          "aspect-square w-full rounded-md border object-cover",
                          thumbIndex === index ? "border-primary" : "border-border/60",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
