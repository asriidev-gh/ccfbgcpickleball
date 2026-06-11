/** Organizer notifications — lightweight poll to detect new QR registrations. */
export const ORGANIZER_NOTIFICATIONS_POLL_MS = 5_000;

/** Spectator live view: queue + courts (still feels live, fewer server hits). */
export const SPECTATOR_LIVE_POLL_MS = 7_000;

/** Spectator match history / session stats — loaded when history is visible. */
export const SPECTATOR_DETAILS_POLL_MS = 15_000;

/** Spectator count badge in the header. */
export const SPECTATOR_COUNT_POLL_MS = 5_000;
