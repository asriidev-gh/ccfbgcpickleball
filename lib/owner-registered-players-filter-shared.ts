import { isPlayerCcfAttended } from "@/lib/player-profile-shared";

export type OwnerRegisteredPlayersCcfFilter = {
  attendedCcf?: boolean;
  notAttendedCcf?: boolean;
  withDgroup?: boolean;
  noDgroupYet?: boolean;
};

export function parseOwnerRegisteredPlayersCcfFilter(
  searchParams: Pick<URLSearchParams, "get">,
): OwnerRegisteredPlayersCcfFilter {
  return {
    attendedCcf: searchParams.get("attendedCcf") === "true" ? true : undefined,
    notAttendedCcf: searchParams.get("notAttendedCcf") === "true" ? true : undefined,
    withDgroup: searchParams.get("withDgroup") === "true" ? true : undefined,
    noDgroupYet: searchParams.get("noDgroupYet") === "true" ? true : undefined,
  };
}

export function hasOwnerRegisteredPlayersCcfFilter(
  filter: OwnerRegisteredPlayersCcfFilter | undefined,
) {
  if (!filter) return false;
  return Boolean(
    filter.attendedCcf || filter.notAttendedCcf || filter.withDgroup || filter.noDgroupYet,
  );
}

export function matchesOwnerRegisteredPlayersCcfFilter(
  player: {
    attendedEvents: string[];
    isPartOfDgroup: boolean;
  },
  filter: OwnerRegisteredPlayersCcfFilter | undefined,
) {
  if (!filter) return true;

  if (filter.notAttendedCcf) {
    return !isPlayerCcfAttended(player.attendedEvents);
  }

  if (!filter.attendedCcf) return true;
  if (!isPlayerCcfAttended(player.attendedEvents)) return false;

  const withDgroup = filter.withDgroup === true;
  const noDgroupYet = filter.noDgroupYet === true;
  if (!withDgroup && !noDgroupYet) return true;

  const hasDgroup = player.isPartOfDgroup === true;
  if (withDgroup && noDgroupYet) return true;
  if (withDgroup) return hasDgroup;
  return !hasDgroup;
}
