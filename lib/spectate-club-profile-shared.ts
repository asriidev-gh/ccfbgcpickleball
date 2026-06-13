export type SpectateClubProfile = {
  clubName: string;
  clubTagline: string;
  clubAdditionalInfo: string;
  clubMissionVision: string;
  clubLogoUrl: string;
  clubFacebookUrl: string;
  clubInstagramUrl: string;
  clubAddress: string;
  clubGoogleMapEmbedUrl: string;
};

export function buildGoogleMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}
