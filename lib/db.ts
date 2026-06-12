import mongoose from "mongoose";

declare global {
  var mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

const CONNECTION_VERIFY_TTL_MS = 30_000;
const RUN_WITH_DATABASE_ATTEMPTS = 5;

let connectedDatabaseName: string | null = null;
let connectionEventsRegistered = false;
let lastVerifiedAt = 0;
let reconnectPromise: Promise<typeof mongoose> | null = null;
let suppressDisconnectReset = false;
let dbOperationChain: Promise<unknown> = Promise.resolve();
let dbWorkDepth = 0;

function runQueuedDatabaseWork<T>(work: () => Promise<T>): Promise<T> {
  if (dbWorkDepth > 0) {
    return work();
  }

  const task = dbOperationChain.then(async () => {
    dbWorkDepth += 1;
    try {
      return await work();
    } finally {
      dbWorkDepth -= 1;
    }
  });

  dbOperationChain = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

function registerConnectionEvents() {
  if (connectionEventsRegistered) return;
  connectionEventsRegistered = true;

  mongoose.connection.on("disconnected", () => {
    lastVerifiedAt = 0;
    if (!suppressDisconnectReset) {
      resetCachedConnection();
    }
  });
  mongoose.connection.on("error", () => {
    lastVerifiedAt = 0;
    if (!suppressDisconnectReset) {
      resetCachedConnection();
    }
  });
}

export function resolveDatabaseName(dbNameOverride?: string) {
  const override = dbNameOverride?.trim();
  if (override) return override;
  return process.env.MONGODB_DB?.trim() || "ccf_pickleball";
}

function getMongoOptions(dbNameOverride?: string) {
  return {
    dbName: resolveDatabaseName(dbNameOverride),
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    // One connection per serverless instance — keeps Atlas Free tier under its 500-connection limit.
    maxPoolSize: 1,
    minPoolSize: 0,
    // Buffer briefly while a stale socket reconnects instead of failing the whole request.
    bufferCommands: true,
  };
}

function isConnectionReady() {
  return mongoose.connection.readyState === 1;
}

function collectErrorMessages(error: unknown) {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }
  if (typeof current === "string") messages.push(current);
  return messages;
}

function isTransientConnectionError(error: unknown) {
  const text = collectErrorMessages(error).join(" ");
  return /must be connected|not connected|connection closed|client was closed|operation interrupted|topology was destroyed|socket has been|connection is not ready|connection failed after multiple attempts/i.test(
    text,
  );
}

function resetCachedConnection() {
  cached.conn = null;
  cached.promise = null;
  connectedDatabaseName = null;
}

function getMongoUri() {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    throw new Error(
      "Please set MONGODB_URI in your environment (for Vercel: Project Settings → Environment Variables).",
    );
  }
  return mongodbUri;
}

async function verifyConnectionAlive() {
  if (!isConnectionReady()) return false;
  if (Date.now() - lastVerifiedAt < CONNECTION_VERIFY_TTL_MS) return true;

  try {
    await mongoose.connection.db?.admin().ping();
    lastVerifiedAt = Date.now();
    return true;
  } catch {
    lastVerifiedAt = 0;
    return false;
  }
}

async function openMongoConnection(
  mongodbUri: string,
  dbNameOverride?: string,
): Promise<typeof mongoose> {
  if (reconnectPromise) {
    return reconnectPromise;
  }

  reconnectPromise = (async () => {
    suppressDisconnectReset = true;
    try {
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
        } catch {
          // Stale or half-open sockets can throw during teardown.
        }
      }

      resetCachedConnection();
      connectedDatabaseName = resolveDatabaseName(dbNameOverride);
      const conn = await mongoose.connect(mongodbUri, getMongoOptions(dbNameOverride));
      cached.conn = conn;
      cached.promise = Promise.resolve(conn);
      lastVerifiedAt = Date.now();
      return conn;
    } finally {
      suppressDisconnectReset = false;
      reconnectPromise = null;
    }
  })();

  return reconnectPromise;
}

async function connectToDatabaseOnce(dbNameOverride?: string): Promise<typeof mongoose> {
  const mongodbUri = getMongoUri();
  const targetDatabaseName = resolveDatabaseName(dbNameOverride);

  registerConnectionEvents();

  if (
    isConnectionReady() &&
    connectedDatabaseName === targetDatabaseName &&
    (await verifyConnectionAlive())
  ) {
    return mongoose;
  }

  if (!cached.promise) {
    cached.promise = openMongoConnection(mongodbUri, dbNameOverride).catch((error) => {
      resetCachedConnection();
      lastVerifiedAt = 0;
      const reason = error instanceof Error ? error.message : "Unknown error";
      console.error("[db] MongoDB connection failed:", reason);
      throw new Error(
        `MongoDB connection failed: ${reason}. Check MONGODB_URI, Atlas network access (allow 0.0.0.0/0 for cloud deploys), and that the cluster is running.`,
      );
    });
  }

  try {
    const conn = await cached.promise;
    if (connectedDatabaseName === targetDatabaseName && (await verifyConnectionAlive())) {
      return conn;
    }

    resetCachedConnection();
    return openMongoConnection(mongodbUri, dbNameOverride);
  } catch (error) {
    resetCachedConnection();
    lastVerifiedAt = 0;
    throw error;
  }
}

export async function connectToDatabase(
  dbNameOverride?: string,
): Promise<typeof mongoose> {
  if (dbWorkDepth > 0) {
    return connectToDatabaseOnce(dbNameOverride);
  }

  return runQueuedDatabaseWork(() => connectToDatabaseOnce(dbNameOverride));
}

async function runWithDatabaseOnce<T>(
  fn: () => Promise<T>,
  dbNameOverride?: string,
): Promise<T> {
  const mongodbUri = getMongoUri();
  let lastError: unknown;

  for (let attempt = 0; attempt < RUN_WITH_DATABASE_ATTEMPTS; attempt++) {
    try {
      await connectToDatabaseOnce(dbNameOverride);
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < RUN_WITH_DATABASE_ATTEMPTS - 1 && isTransientConnectionError(error);
      if (!shouldRetry) break;

      lastVerifiedAt = 0;
      resetCachedConnection();
      try {
        await openMongoConnection(mongodbUri, dbNameOverride);
      } catch {
        // Next loop iteration will try again.
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }

  const { recordSystemLog } = await import("@/lib/system-log");
  recordSystemLog({
    level: "error",
    source: "db",
    message: lastError instanceof Error ? lastError.message : "Database operation failed.",
    stack: lastError instanceof Error ? lastError.stack : undefined,
    metadata: {
      attempts: RUN_WITH_DATABASE_ATTEMPTS,
      transient: isTransientConnectionError(lastError),
    },
  });

  throw lastError instanceof Error
    ? lastError
    : new Error("Database operation failed after retry.");
}

/** Connect, run queries, and transparently retry on stale serverless sockets. */
export async function runWithDatabase<T>(
  fn: () => Promise<T>,
  dbNameOverride?: string,
): Promise<T> {
  return runQueuedDatabaseWork(() => runWithDatabaseOnce(fn, dbNameOverride));
}

export async function disconnectFromDatabase() {
  return runQueuedDatabaseWork(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    lastVerifiedAt = 0;
    resetCachedConnection();
  });
}

export async function getDatabaseHealth() {
  return runWithDatabase(async () => {
    await connectToDatabaseOnce();
    await mongoose.connection.db?.admin().ping();
    return {
      ok: true as const,
      dbName: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    };
  }).catch((error) => ({
    ok: false as const,
    message: error instanceof Error ? error.message : "Database connection failed.",
    hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
    dbName: process.env.MONGODB_DB ?? "ccf_pickleball",
  }));
}
