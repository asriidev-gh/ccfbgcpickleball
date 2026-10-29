/**
 * Who a Player row counts as: the name the player registered with. Email is deliberately
 * not used, because organizers often register guests and family under their own address, which
 * would fold different people into one identity. Email only identifies players with no usable
 * name. Client-safe, so the leaderboard and the endorse buttons agree on who is who.
 */
export function leaderboardIdentityKey(player: {
  _id?: { toString(): string } | string | null;
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  const normalize = (value?: string) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const name = `${normalize(player.firstName)}|${normalize(player.lastName)}`;
  if (name !== "|") return `name:${name}`;

  const email = normalize(player.email);
  if (email) return `email:${email}`;
  return `id:${player._id != null ? String(player._id) : ""}`;
}
