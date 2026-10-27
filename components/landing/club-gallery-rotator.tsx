"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";

import { ClubPhotoLightbox } from "@/components/landing/club-photo-lightbox";
import { CLUB_GALLERY_ROTATE_MS, type ClubPhoto } from "@/lib/club-photos";
import { cn } from "@/lib/utils";

/** Small offset per tile so the grid cascades instead of flipping all at once. */
const TILE_STAGGER_MS = 90;

/** Outgoing, incoming, and the one being fetched for the next turn. */
const LAYERS = [0, 1, 2];

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A fresh set of distinct photos, avoiding any that are on screen or already queued. */
function nextSelection(pool: ClubPhoto[], exclude: ClubPhoto[], count: number) {
  const taken = new Set(exclude.map((photo) => photo.src));
  const unseen = pool.filter((photo) => !taken.has(photo.src));
  const source = unseen.length >= count ? unseen : pool;
  return shuffle(source).slice(0, count);
}

/** Wraps the pool, so a folder smaller than two screenfuls still fills every tile. */
function sliceWrapping(pool: ClubPhoto[], start: number, count: number) {
  return Array.from({ length: count }, (_, offset) => pool[(start + offset) % pool.length]);
}

function sizesFor(isFeature: boolean) {
  return isFeature
    ? "(max-width: 1024px) 100vw, 640px"
    : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px";
}

/**
 * One tile, with no state of its own.
 *
 * Three layers stay mounted and rotate roles as `generation` advances: one is on screen, one
 * is fading out behind it, and one is invisible but already loading the photo this tile will
 * show next. Only that third layer ever changes `src`, which gives the browser a full
 * interval to fetch a photo before it is revealed, and lets the whole wipe be derived from
 * props instead of synchronised in an effect.
 */
function DiamondTile({
  current,
  previous,
  upcoming,
  generation,
  isFeature,
  delayMs,
  onOpen,
}: {
  current: ClubPhoto;
  previous: ClubPhoto;
  upcoming: ClubPhoto;
  generation: number;
  isFeature: boolean;
  delayMs: number;
  onOpen: () => void;
}) {
  const active = generation % LAYERS.length;

  const photoFor = (layer: number) => {
    if (layer === active) return current;
    if (layer === (active + 1) % LAYERS.length) return upcoming;
    return previous;
  };

  return (
    <li className={cn("club-gallery__tile", isFeature && "club-gallery__tile--feature")}>
      {/* The stagger rides on a custom property: an inline `transition-delay` would also
          override the per-property delays the wipe depends on. */}
      <button
        type="button"
        className="club-gallery__open"
        style={{ "--tile-delay": `${delayMs}ms` } as CSSProperties}
        onClick={onOpen}
        aria-label={`View photo: ${current.alt}`}
      >
        {LAYERS.map((layer) => {
          const photo = photoFor(layer);
          return (
            <Image
              key={layer}
              src={photo.src}
              // Decorative: the button label above describes the photo on screen.
              alt=""
              aria-hidden
              fill
              // Eager on purpose: the hidden layers are clipped to nothing, so a lazy image
              // there is never fetched and the photo would pop in blank when its turn comes.
              loading="eager"
              sizes={sizesFor(isFeature)}
              className={cn("club-gallery__img", layer === active && "club-gallery__img--on")}
              style={{ objectPosition: photo.focus }}
            />
          );
        })}
      </button>
    </li>
  );
}

export function ClubGalleryRotator({
  photos,
  tileCount,
}: {
  photos: ClubPhoto[];
  tileCount: number;
}) {
  // Both the visible set and the queued set are deterministic on first paint, so server and
  // client markup agree. Randomising only starts once the interval below runs.
  const [rotation, setRotation] = useState(() => {
    const current = photos.slice(0, tileCount);
    return {
      current,
      previous: current,
      upcoming: photos.length > 0 ? sliceWrapping(photos, tileCount, tileCount) : current,
      generation: 0,
    };
  });
  const [viewing, setViewing] = useState<number | null>(null);

  // Holding the gallery still while a photo is open: otherwise the tiles would shuffle behind
  // the backdrop, and the photo you clicked would be gone when you closed the viewer.
  const isViewing = viewing !== null;

  useEffect(() => {
    if (photos.length <= tileCount) return;
    if (isViewing) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      // Nothing to see on a background tab, and it would burn through the pool unwatched.
      if (document.visibilityState !== "visible") return;
      setRotation((state) => ({
        previous: state.current,
        // Promoting the set that has been loading for the last interval, so the wipe reveals
        // a photo that is already decoded rather than an empty tile.
        current: state.upcoming,
        upcoming: nextSelection(photos, [...state.upcoming, ...state.current], tileCount),
        generation: state.generation + 1,
      }));
    }, CLUB_GALLERY_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [photos, tileCount, isViewing]);

  if (rotation.current.length === 0) return null;

  return (
    <>
      <ul className="club-gallery mt-8">
        {rotation.current.map((photo, index) => (
          <DiamondTile
            // Keyed by position: the tile persists and its contents wipe.
            key={index}
            current={photo}
            previous={rotation.previous[index] ?? photo}
            upcoming={rotation.upcoming[index] ?? photo}
            generation={rotation.generation}
            isFeature={index === 0}
            delayMs={index * TILE_STAGGER_MS}
            onOpen={() => {
              // Matched by src: `photos` may be a fresh array from the server, so the object
              // in this slot is not guaranteed to be identical to the one in the pool.
              const poolIndex = photos.findIndex((candidate) => candidate.src === photo.src);
              setViewing(poolIndex === -1 ? 0 : poolIndex);
            }}
          />
        ))}
      </ul>

      <ClubPhotoLightbox
        photos={photos}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </>
  );
}
