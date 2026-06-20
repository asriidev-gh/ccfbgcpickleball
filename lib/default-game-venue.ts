import { normalizeClubGoogleMapEmbedUrl } from "@/lib/club-settings-shared";
import { USER_TYPE_CCF, USER_TYPE_DEFAULT } from "@/lib/registration-variant";
export const DEFAULT_GAME_VENUE_NAME = "Dragonsmash Taguig Branch";

export const DEFAULT_GAME_VENUE_ADDRESS =
  "G3QG+36P, Pedro Cayetano Boulevard (Levi Mariano Avenue), Palingon Tipas, Taguig City, Metro Manila, Philippine";

export const DEFAULT_GAME_VENUE_GOOGLE_MAP_EMBED_HTML = `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3862.0747353460056!2d121.0730031757324!3d14.53771767861184!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c9003eb2b835%3A0x2e826c2ce0031460!2sDragonSmash%20-%20Taguig!5e0!3m2!1sen!2sph!4v1781949400285!5m2!1sen!2sph" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

export const DEFAULT_GAME_VENUE_GOOGLE_MAP_EMBED_URL = normalizeClubGoogleMapEmbedUrl(
  DEFAULT_GAME_VENUE_GOOGLE_MAP_EMBED_HTML,
);

export function getDefaultGameVenueForUserType(userType: string | undefined | null) {
  const normalized = userType?.trim().toLowerCase();
  const useDefaults =
    !normalized || normalized === USER_TYPE_DEFAULT || normalized === USER_TYPE_CCF;

  if (!useDefaults) {
    return {
      venueName: "",
      venueAddress: "",
      venueGoogleMapEmbedUrl: "",
    };
  }

  return {
    venueName: DEFAULT_GAME_VENUE_NAME,
    venueAddress: DEFAULT_GAME_VENUE_ADDRESS,
    venueGoogleMapEmbedUrl: DEFAULT_GAME_VENUE_GOOGLE_MAP_EMBED_URL,
  };
}