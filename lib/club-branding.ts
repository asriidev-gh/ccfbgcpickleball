export type ClubBranding = {
  clubName: string;
  clubLogoUrl: string;
  clubTagline: string;
};

export type ClubBrandingOwnerFields = {
  name?: string;
  clubName?: string;
  clubLogoUrl?: string;
  clubTagline?: string;
};

/** Use saved club fields when present; otherwise keep the default app brand. */
export function resolveClubBranding(owner: ClubBrandingOwnerFields): ClubBranding | null {
  const clubLogoUrl =
    typeof owner.clubLogoUrl === "string" ? owner.clubLogoUrl.trim() : "";
  const savedClubName =
    typeof owner.clubName === "string" ? owner.clubName.trim() : "";
  const clubTagline =
    typeof owner.clubTagline === "string" ? owner.clubTagline.trim() : "";
  const accountName = typeof owner.name === "string" ? owner.name.trim() : "";

  if (!savedClubName && !clubLogoUrl) {
    return null;
  }

  const clubName = savedClubName || accountName;
  if (!clubName) {
    return null;
  }

  return { clubName, clubLogoUrl, clubTagline };
}
