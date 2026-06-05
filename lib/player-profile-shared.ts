import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";

export const PICKLEBALL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "low_intermediate", label: "Low intermediate" },
  { value: "high_intermediate", label: "High intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "pro", label: "Pro" },
] as const;

export type PickleballLevel = (typeof PICKLEBALL_LEVELS)[number]["value"];

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number]["value"];

export function deriveCcfEventsBefore(attendedEvents: string[] | undefined | null) {
  if (!attendedEvents?.length) return null;
  if (attendedEvents.length === 1 && attendedEvents[0] === CCF_ATTENDED_NOT_YET) {
    return "not_yet" as const;
  }
  return "yes" as const;
}
