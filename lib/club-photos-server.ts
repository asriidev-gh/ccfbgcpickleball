import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  CLUB_PHOTO_DEFAULT_ALT,
  CLUB_PHOTO_DIR,
  CLUB_PHOTO_OVERRIDES,
  defaultFocusForOrientation,
  type ClubPhoto,
} from "@/lib/club-photos";

const PHOTO_ROOT = path.join(process.cwd(), "public", "assets", "images", "cc_bgc_pickleball");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

/** Minimal JPEG header read: enough to know orientation without pulling in an image library. */
function readJpegSize(buffer: Buffer) {
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength <= 0) break;
    offset += 2 + segmentLength;
  }
  return null;
}

let cached: ClubPhoto[] | null = null;

/**
 * Every photo in the club folder, deduplicated by content so the same shot cannot appear in
 * two tiles at once. Reads the folder once per server process; restart to pick up new files.
 */
export function listClubPhotos(): ClubPhoto[] {
  if (cached) return cached;

  let files: string[];
  try {
    files = readdirSync(PHOTO_ROOT);
  } catch {
    cached = [];
    return cached;
  }

  const seenContent = new Set<string>();
  const photos: ClubPhoto[] = [];

  for (const file of files.sort()) {
    if (!IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;

    let buffer: Buffer;
    try {
      buffer = readFileSync(path.join(PHOTO_ROOT, file));
    } catch {
      continue;
    }

    // The folder came from a social export and contains at least one byte-identical copy.
    const digest = createHash("md5").update(buffer).digest("hex");
    if (seenContent.has(digest)) continue;
    seenContent.add(digest);

    const size = readJpegSize(buffer);
    const override = CLUB_PHOTO_OVERRIDES[file];

    photos.push({
      src: `${CLUB_PHOTO_DIR}/${file}`,
      alt: override?.alt ?? CLUB_PHOTO_DEFAULT_ALT,
      focus:
        override?.focus ??
        (size ? defaultFocusForOrientation(size.width, size.height) : "center 50%"),
      width: size?.width,
      height: size?.height,
    });
  }

  cached = photos;
  return cached;
}
