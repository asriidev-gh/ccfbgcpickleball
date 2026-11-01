"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { ClubPhotoLightbox } from "@/components/landing/club-photo-lightbox";
import {
  CLUB_GALLERY_ROTATE_MS,
  orientationOf,
  type ClubPhoto,
  type ClubPhotoOrientation,
} from "@/lib/club-photos";
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

type Pools = Record<ClubPhotoOrientation, ClubPhoto[]>;

/** The folder split by orientation. An orientation with no photos at all borrows the whole folder. */
function poolsFor(photos: ClubPhoto[]): Pools {
  const portrait = photos.filter((photo) => orientationOf(photo) === "portrait");
  const landscape = photos.filter((photo) => orientationOf(photo) === "landscape");
  return {
    portrait: portrait.length > 0 ? portrait : photos,
    landscape: landscape.length > 0 ? landscape : photos,
  };
}

/** Picks photos for each orientation, then deals them out to the slots in grid order. */
function fillSlots(
  slots: readonly ClubPhotoOrientation[],
  pick: (orientation: ClubPhotoOrientation, count: number) => ClubPhoto[],
) {
  const picked = new Map<ClubPhotoOrientation, ClubPhoto[]>();
  for (const orientation of new Set(slots)) {
    picked.set(orientation, pick(orientation, slots.filter((slot) => slot === orientation).length));
  }
  const dealt = new Map<ClubPhotoOrientation, number>();
  return slots.map((orientation) => {
    const photos = picked.get(orientation) ?? [];
    const index = dealt.get(orientation) ?? 0;
    dealt.set(orientation, index + 1);
    // Wrapping, in case a pool has fewer photos than slots of its shape.
    return photos[index % photos.length];
  });
}

/** A fresh set of distinct photos, avoiding any that are on screen or already queued. */
function nextSelection(pools: Pools, slots: readonly ClubPhotoOrientation[], exclude: ClubPhoto[]) {
  const taken = new Set(exclude.map((photo) => photo.src));
  return fillSlots(slots, (orientation, count) => {
    const pool = pools[orientation];
    const unseen = pool.filter((photo) => !taken.has(photo.src));
    const source = unseen.length >= count ? unseen : pool;
    const picked = shuffle(source).slice(0, count);
    // When one orientation borrows the whole folder, this stops the other repeating its picks.
    for (const photo of picked) taken.add(photo.src);
    return picked;
  });
}

/** Wraps the pool, so a folder smaller than two screenfuls still fills every tile. */
function sliceWrapping(pool: ClubPhoto[], start: number, count: number) {
  return Array.from({ length: count }, (_, offset) => pool[(start + offset) % pool.length]);
}

/** The first screenful (`round` 0) or the one after it, in folder order within each orientation. */
function orderedSelection(pools: Pools, slots: readonly ClubPhotoOrientation[], round: number) {
  return fillSlots(slots, (orientation, count) =>
    sliceWrapping(pools[orientation], round * count, count),
  );
}

/** Tall tiles are one column wide, the same as small ones. */
function sizesFor(isFeature: boolean) {
  return isFeature
    ? "(max-width: 767px) 100vw, (max-width: 1280px) 50vw, 640px"
    : "(max-width: 767px) 50vw, (max-width: 1280px) 25vw, 320px";
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
  isTall,
  delayMs,
  onOpen,
}: {
  current: ClubPhoto;
  previous: ClubPhoto;
  upcoming: ClubPhoto;
  generation: number;
  isFeature: boolean;
  isTall: boolean;
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
    <li
      className={cn(
        "club-gallery__tile",
        isFeature && "club-gallery__tile--feature",
        isTall && "club-gallery__tile--tall",
      )}
    >
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
  slots,
}: {
  photos: ClubPhoto[];
  slots: readonly ClubPhotoOrientation[];
}) {
  const pools = useMemo(() => poolsFor(photos), [photos]);

  // Both the visible set and the queued set are deterministic on first paint, so server and
  // client markup agree. Randomising only starts once the interval below runs.
  const [rotation, setRotation] = useState(() => {
    const current = photos.length > 0 ? orderedSelection(pools, slots, 0) : [];
    return {
      current,
      previous: current,
      upcoming: photos.length > 0 ? orderedSelection(pools, slots, 1) : current,
      generation: 0,
    };
  });
  const [viewing, setViewing] = useState<number | null>(null);

  // Holding the gallery still while a photo is open: otherwise the tiles would shuffle behind
  // the backdrop, and the photo you clicked would be gone when you closed the viewer.
  const isViewing = viewing !== null;

  useEffect(() => {
    if (photos.length <= slots.length) return;
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
        upcoming: nextSelection(pools, slots, [...state.upcoming, ...state.current]),
        generation: state.generation + 1,
      }));
    }, CLUB_GALLERY_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [photos.length, pools, slots, isViewing]);

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
            isTall={slots[index] === "portrait"}
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
