import { ClubGalleryRotator } from "@/components/landing/club-gallery-rotator";
import { CLUB_GALLERY_TILE_COUNT } from "@/lib/club-photos";
import { listClubPhotos } from "@/lib/club-photos-server";

/**
 * Bento grid of club photos that rotates through the whole folder. Reading the folder here,
 * on the server, keeps the filesystem out of the client bundle.
 */
export function ClubGallery() {
  const photos = listClubPhotos();
  if (photos.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-14 lg:px-10 lg:pt-20">
      <header className="max-w-2xl">
        <p className="landing-kicker">On the court</p>
        <h2 className="page-title mt-2">This is what a session looks like</h2>
      </header>

      <ClubGalleryRotator photos={photos} tileCount={CLUB_GALLERY_TILE_COUNT} />
    </section>
  );
}
