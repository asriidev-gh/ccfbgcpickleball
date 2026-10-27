import { Cross } from "lucide-react";
import Image from "next/image";

import { CLUB_BANNER_PHOTO } from "@/lib/club-photos";

/**
 * Full-bleed community photo with a dark scrim.
 *
 * The scrim is always dark and the text on it always light, so this block reads the same in
 * every theme rather than depending on theme tokens that flip between light and dark.
 */
export function CommunityBand() {
  return (
    <section className="community-band" aria-labelledby="community-band-title">
      <Image
        src={CLUB_BANNER_PHOTO.src}
        alt={CLUB_BANNER_PHOTO.alt}
        width={CLUB_BANNER_PHOTO.width}
        height={CLUB_BANNER_PHOTO.height}
        sizes="100vw"
        className="community-band__img"
        style={{ objectPosition: CLUB_BANNER_PHOTO.focus }}
      />
      <div className="community-band__scrim" aria-hidden />

      <div className="community-band__body">
        <p className="community-band__kicker">Play with purpose</p>
        <h2 id="community-band-title" className="community-band__title">
          Come for the game, stay for the people
        </h2>
        <p className="community-band__text">
          Open play is open to everyone, whether it is your first time holding a paddle or you
          have been rotating through these courts for months.
        </p>
        <blockquote className="community-band__verse">
          <Cross className="h-4 w-4" aria-hidden />
          <p>
            &ldquo;So whether you eat or drink or whatever you do, do it all for the glory of
            God.&rdquo;
            <cite>1 Corinthians 10:31</cite>
          </p>
        </blockquote>
      </div>
    </section>
  );
}
