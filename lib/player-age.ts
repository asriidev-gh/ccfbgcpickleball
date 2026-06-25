export function computePlayerAgeYears(
  birthdate: string | Date | null | undefined,
  referenceDate = new Date(),
): number | null {
  if (!birthdate) return null;

  let birth: Date;
  if (birthdate instanceof Date) {
    birth = birthdate;
  } else {
    const trimmed = birthdate.trim();
    if (!trimmed) return null;
    birth = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00.000Z`)
      : new Date(trimmed);
  }

  if (Number.isNaN(birth.getTime())) return null;

  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = referenceDate.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = referenceDate.getUTCDate() - birth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  if (age <= 0 || age > 120) return null;
  return age;
}

export function formatGenderAgePillLabel(shortGender: string, ageYears: number | null) {
  if (ageYears == null || ageYears <= 0) return shortGender;
  return `${shortGender}-${ageYears}Y`;
}
