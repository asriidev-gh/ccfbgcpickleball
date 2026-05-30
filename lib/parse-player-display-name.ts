import { capitalizeNameWords } from "@/lib/utils";

/** Splits a single display name into first/last for player records. */
export function parsePlayerDisplayName(fullName: string) {
  const normalized = capitalizeNameWords(fullName);
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Player", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
