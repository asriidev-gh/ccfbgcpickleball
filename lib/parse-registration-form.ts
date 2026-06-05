import type { z } from "zod";

import type { RegistrationFormVariant } from "@/lib/registration-variant";
import {
  genericPlayerSchema,
  newPlayerSchema,
  volunteerNewPlayerSchema,
} from "@/lib/validations";

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
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function parseGenericPlayerPayloadFromFormData(formData: FormData) {
  const body = {
    gameId: formString(formData, "gameId"),
    firstName: formString(formData, "firstName"),
    lastName: formString(formData, "lastName"),
    mobileNumber: formString(formData, "mobileNumber"),
    email: formString(formData, "email"),
  };

  return genericPlayerSchema.safeParse(body);
}

export function parseNewPlayerPayloadFromFormData(
  formData: FormData,
  variant: RegistrationFormVariant = "ccf",
) {
  if (variant === "generic") {
    return parseGenericPlayerPayloadFromFormData(formData);
  }

  const volunteerTypeRaw = formString(formData, "volunteerType");
  const volunteerType =
    volunteerTypeRaw === "Pickleball" ||
    volunteerTypeRaw === "Running" ||
    volunteerTypeRaw === "Badminton" ||
    volunteerTypeRaw === "Other"
      ? volunteerTypeRaw
      : undefined;

  if (volunteerType) {
    return volunteerNewPlayerSchema.safeParse({
      gameId: formString(formData, "gameId"),
      firstName: formString(formData, "firstName"),
      lastName: formString(formData, "lastName"),
      mobileNumber: formString(formData, "mobileNumber"),
      email: formString(formData, "email"),
      volunteerType,
      volunteerTypeOther: formString(formData, "volunteerTypeOther"),
    });
  }

  const body = {
    gameId: formString(formData, "gameId"),
    firstName: formString(formData, "firstName"),
    lastName: formString(formData, "lastName"),
    mobileNumber: formString(formData, "mobileNumber"),
    email: formString(formData, "email"),
    firstTimeSportsMinistry: formBoolean(formData, "firstTimeSportsMinistry"),
    isPartOfDgroup: formBoolean(formData, "isPartOfDgroup"),
    wantsToJoinDgroup: formNullableBoolean(formData, "wantsToJoinDgroup"),
    attendedEvents: formStringArray(formData, "attendedEvents"),
    attendedEventsOther: formString(formData, "attendedEventsOther"),
    volunteerTypeOther: formString(formData, "volunteerTypeOther"),
  };

  return newPlayerSchema.safeParse(body);
}

export type NewPlayerPayload = z.infer<typeof newPlayerSchema>;
export type GenericPlayerPayload = z.infer<typeof genericPlayerSchema>;

export function getRegistrationPhotoFromFormData(formData: FormData) {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    return photo;
  }
  return null;
}
