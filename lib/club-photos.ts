/**
 * Photos from the club's own albums, in `public/assets/images/cc_bgc_pickleball`.
 *
 * The gallery rotates through every photo in that folder (see `club-photos-server.ts`), so
 * dropping a new file in is all it takes to include it. This module holds the pieces that
 * are safe for the client: types, the fixed banner photo, and the per-photo overrides.
 *
 * A focal point matters because tiles are a fixed shape and crop with `object-fit: cover`.
 * Several group shots put people in the lower third, which a centred crop would cut to wall.
 */
export type ClubPhoto = {
  src: string;
  alt: string;
  /** CSS object-position for the cover crop. */
  focus: string;
  /** Intrinsic size, when it could be read from the file header. Used by the lightbox. */
  width?: number;
  height?: number;
};

export const CLUB_PHOTO_DIR = "/assets/images/cc_bgc_pickleball";

/**
 * How long each photo stays on screen before the gallery wipes to the next one.
 *
 * The wipe itself is timed in CSS (`--club-gallery-fade` / `--club-gallery-wipe` in
 * `globals.css`) and must finish well inside this interval, stagger included.
 */
export const CLUB_GALLERY_ROTATE_MS = 3000;

/** Number of tiles in the bento grid. The first is the large feature tile. */
export const CLUB_GALLERY_TILE_COUNT = 5;

/** Used when a photo has not been individually reviewed. True of every photo in the folder. */
export const CLUB_PHOTO_DEFAULT_ALT = "Players during an open play session at CCF BGC Pickleball.";

/** Wide community shot used for the full-bleed band. Deliberately not part of the rotation. */
export const CLUB_BANNER_PHOTO = {
  src: `${CLUB_PHOTO_DIR}/834252133_122185822478602686_5416405184752883876_n.jpg`,
  alt: "The CCF BGC pickleball community gathered on court around the CCF Sports BGC banner at the end of an open play session.",
  width: 2048,
  height: 1153,
  focus: "center 45%",
};

/** Hand-written alt text and crops for the photos that have been reviewed. */
export const CLUB_PHOTO_OVERRIDES: Record<string, { alt: string; focus?: string }> = {
  "713950827_122174947766602686_3350245593968256111_n.jpg": {
    alt: "A large group of players posing on court with the CCF Sports BGC banner.",
    focus: "center 55%",
  },
  "856093521_122187116378602686_3653666587344006134_n.jpg": {
    alt: "A player serving during open play, with several other courts in action behind him.",
    focus: "center 40%",
  },
  "857201072_122187109340602686_5228133913784759386_n.jpg": {
    alt: "An organizer speaking into a microphone courtside while players listen from the sidelines.",
    focus: "center 50%",
  },
  "684827867_122172137768602686_5217683141911447468_n.jpg": {
    alt: "Players smiling together courtside after a session.",
    focus: "center 78%",
  },
  "689492413_122172790688602686_3682386772391424052_n.jpg": {
    alt: "Players holding up their paddles for a photo beside the courts.",
    focus: "center 72%",
  },
};

/**
 * Default crop for photos nobody has reviewed. Phone-portrait shots in this folder are
 * typically group photos with everyone standing in the lower half, so they are biased down;
 * landscape action shots sit slightly above centre.
 */
export function defaultFocusForOrientation(width: number, height: number) {
  return height > width ? "center 65%" : "center 45%";
}
