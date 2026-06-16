export type SpectateClubOrganizer = {
  name: string;
  photoUrl: string;
};

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
  clubOrganizers: SpectateClubOrganizer[];
};

export function profileHasAboutDetails(profile: SpectateClubProfile) {
  return Boolean(
    profile.clubMissionVision ||
      profile.clubFacebookUrl ||
      profile.clubInstagramUrl ||
      profile.clubAddress ||
      profile.clubGoogleMapEmbedUrl,
  );
}

export function buildGoogleMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}
