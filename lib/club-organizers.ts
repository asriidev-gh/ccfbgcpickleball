import {
  deleteRegistrationPhotos,
  uploadClubOrganizerPhoto,
} from "@/lib/cloudinary";
import type { ClubOrganizer } from "@/lib/club-settings-shared";
import { normalizeClubOrganizers } from "@/lib/club-settings-shared";
import type { clubOrganizerEntrySchema } from "@/lib/validations";
import type { z } from "zod";

type OrganizerPayload = z.infer<typeof clubOrganizerEntrySchema>;

type StoredOrganizer = {
  name?: string;
  photoUrl?: string;
  photoPublicId?: string;
};

export async function resolveClubOrganizersFromFormData(
  formData: FormData,
  existingOrganizers: StoredOrganizer[],
  userId: string,
): Promise<ClubOrganizer[]> {
  const rawPayload = formData.get("clubOrganizers");
  if (typeof rawPayload !== "string" || !rawPayload.trim()) {
    return [];
  }

  let parsedPayload: OrganizerPayload[];
  try {
    parsedPayload = JSON.parse(rawPayload) as OrganizerPayload[];
  } catch {
    throw new Error("Invalid organizers data.");
  }

  if (!Array.isArray(parsedPayload)) {
    throw new Error("Invalid organizers data.");
  }

  const existingPublicIds = new Set(
    normalizeClubOrganizers(existingOrganizers)
      .map((entry) => entry.photoPublicId)
      .filter((value): value is string => Boolean(value)),
  );
  const keptPublicIds = new Set<string>();
  const nextOrganizers: ClubOrganizer[] = [];

  for (let index = 0; index < parsedPayload.length; index += 1) {
    const entry = parsedPayload[index];
    const name = entry.name.trim();
    const photoFile = formData.get(`organizerPhoto_${index}`);
    const hasUpload = photoFile instanceof File && photoFile.size > 0;

    let photoUrl = "";
    let photoPublicId = "";

    if (hasUpload) {
      const uploaded = await uploadClubOrganizerPhoto(photoFile, { userId, index });
      photoUrl = uploaded.photoUrl;
      photoPublicId = uploaded.photoPublicId;
      keptPublicIds.add(photoPublicId);
    } else if (!entry.removePhoto && entry.photoUrl.trim()) {
      photoUrl = entry.photoUrl.trim();
      photoPublicId = entry.photoPublicId?.trim() ?? "";
      if (photoPublicId) {
        keptPublicIds.add(photoPublicId);
      }
    }

    nextOrganizers.push({
      name,
      photoUrl,
      ...(photoPublicId ? { photoPublicId } : {}),
    });
  }

  const publicIdsToDelete = [...existingPublicIds].filter((id) => !keptPublicIds.has(id));
  if (publicIdsToDelete.length > 0) {
    await deleteRegistrationPhotos(publicIdsToDelete);
  }

  return nextOrganizers;
}
