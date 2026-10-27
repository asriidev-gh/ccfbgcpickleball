"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

import type { ClubPhoto } from "@/lib/club-photos";

/** A horizontal drag shorter than this counts as a tap, not a swipe. */
const SWIPE_THRESHOLD_PX = 48;

/** Only used if a file header could not be parsed; the real aspect takes over once it loads. */
const FALLBACK_SIZE = { width: 1600, height: 1200 };

/**
 * Full-screen viewer for a single club photo, opened from the gallery.
 *
 * It browses the whole folder rather than just the five tiles on screen, so a visitor who
 * opens one photo can arrow through every photo the club has published.
 */
export function ClubPhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: ClubPhoto[];
  /** The photo being viewed, or `null` when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const step = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return;
      // Wraps, so arrowing past either end keeps browsing instead of dead-ending.
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, onIndexChange, photos.length],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Ignore drags that are mostly vertical: those are scroll attempts, not swipes.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    step(dx < 0 ? 1 : -1);
  };

  const photo = index === null ? undefined : photos[index];
  if (index === null || !photo) return null;

  const hasSiblings = photos.length > 1;

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="club-lightbox__backdrop" />
        <Dialog.Popup
          className="club-lightbox"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              step(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              step(-1);
            }
          }}
        >
          <Dialog.Title className="sr-only">Club photos</Dialog.Title>
          <Dialog.Description className="sr-only">
            {`Photo ${index + 1} of ${photos.length}. Use the left and right arrow keys to browse.`}
          </Dialog.Description>

          <Dialog.Close className="club-lightbox__close" aria-label="Close photo viewer">
            <X aria-hidden="true" />
          </Dialog.Close>

          <figure
            className="club-lightbox__figure"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
            <div className="club-lightbox__frame">
              <Image
                // Remounting on change restarts the fade, so each photo arrives the same way.
                key={photo.src}
                src={photo.src}
                // The caption below carries the description, so repeating it here would make
                // screen readers announce the same sentence twice.
                alt=""
                width={photo.width ?? FALLBACK_SIZE.width}
                height={photo.height ?? FALLBACK_SIZE.height}
                sizes="(max-width: 1024px) 100vw, 1100px"
                className="club-lightbox__img"
                loading="eager"
                fetchPriority="high"
                draggable={false}
              />
            </div>

            <figcaption className="club-lightbox__caption">
              <span className="club-lightbox__count">
                {index + 1} / {photos.length}
              </span>
              <span className="club-lightbox__alt">{photo.alt}</span>
            </figcaption>
          </figure>

          {hasSiblings && (
            <>
              <button
                type="button"
                className="club-lightbox__nav club-lightbox__nav--prev"
                onClick={() => step(-1)}
                aria-label="Previous photo"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="club-lightbox__nav club-lightbox__nav--next"
                onClick={() => step(1)}
                aria-label="Next photo"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
