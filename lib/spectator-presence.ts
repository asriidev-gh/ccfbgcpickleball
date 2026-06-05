const SPECTATOR_PRESENCE_TTL_MS = 12_000;

type SpectatorPresenceStore = Map<string, Map<string, number>>;

const globalForPresence = globalThis as typeof globalThis & {
  spectatorPresenceStore?: SpectatorPresenceStore;
};

const store = globalForPresence.spectatorPresenceStore ?? new Map();
globalForPresence.spectatorPresenceStore = store;

function pruneGame(gameId: string, now = Date.now()) {
  const gameSessions = store.get(gameId);
  if (!gameSessions) return;

  const cutoff = now - SPECTATOR_PRESENCE_TTL_MS;
  for (const [sessionId, lastSeen] of gameSessions) {
    if (lastSeen < cutoff) {
      gameSessions.delete(sessionId);
    }
  }

  if (gameSessions.size === 0) {
    store.delete(gameId);
  }
}

export function touchSpectatorPresence(gameId: string, sessionId: string) {
  const now = Date.now();
  pruneGame(gameId, now);

  let gameSessions = store.get(gameId);
  if (!gameSessions) {
    gameSessions = new Map();
    store.set(gameId, gameSessions);
  }

  gameSessions.set(sessionId, now);
}

export function removeSpectatorPresence(gameId: string, sessionId: string) {
  store.get(gameId)?.delete(sessionId);
  if (store.get(gameId)?.size === 0) {
    store.delete(gameId);
  }
}

export function getSpectatorCount(gameId: string) {
  const now = Date.now();
  pruneGame(gameId, now);

  const gameSessions = store.get(gameId);
  if (!gameSessions) return 0;

  const cutoff = now - SPECTATOR_PRESENCE_TTL_MS;
  let count = 0;
  for (const lastSeen of gameSessions.values()) {
    if (lastSeen >= cutoff) count++;
  }
  return count;
}
