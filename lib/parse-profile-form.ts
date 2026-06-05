import type { z } from "zod";

import { profileBaseSchema, profileCcfFieldsSchema } from "@/lib/validations";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "true";
}

function formNullableBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function formStringArray(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function getProfilePhotoFromFormData(formData: FormData) {
  const photo = formData.get("photo");
  return photo instanceof File && photo.size > 0 ? photo : null;
}

type ProfilePayload = z.infer<typeof profileBaseSchema> &
  Partial<z.infer<typeof profileCcfFieldsSchema>>;

export function parseProfilePayloadFromFormData(
  formData: FormData,
  includeCcf: boolean,
): { success: true; data: ProfilePayload } | { success: false; error: z.ZodError } {
  const baseBody = {
    firstName: formString(formData, "firstName"),
    lastName: formString(formData, "lastName"),
    mobileNumber: formString(formData, "mobileNumber"),
    gender: formString(formData, "gender"),
    birthdate: formString(formData, "birthdate"),
    biography: formString(formData, "biography"),
    pickleballLevel: formString(formData, "pickleballLevel"),
  };

  const baseParsed = profileBaseSchema.safeParse(baseBody);
  if (!baseParsed.success) return baseParsed;

  if (!includeCcf) {
    return { success: true, data: baseParsed.data };
  }

  const ccfBody = {
    isPartOfDgroup: formBoolean(formData, "isPartOfDgroup"),
    wantsToJoinDgroup: formNullableBoolean(formData, "wantsToJoinDgroup"),
    attendedEvents: formStringArray(formData, "attendedEvents"),
    attendedEventsOther: formString(formData, "attendedEventsOther"),
  };
  const ccfParsed = profileCcfFieldsSchema.safeParse(ccfBody);
  if (!ccfParsed.success) return ccfParsed;

  return {
    success: true,
    data: { ...baseParsed.data, ...ccfParsed.data },
  };
}
