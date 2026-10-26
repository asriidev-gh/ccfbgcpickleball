import { AsyncLocalStorage } from "node:async_hooks";
import dns from "node:dns";
import mongoose from "mongoose";

import { isInfrastructureError } from "@/lib/infrastructure-error";

// Some local networks/routers refuse SRV lookups (querySrv ECONNREFUSED) needed by mongodb+srv://.
// In development only, fall back to public resolvers. Set MONGODB_DNS_SERVERS to override (comma-separated).
// Re-applied before every connect attempt because a single call at module load was not reliable on cold start.
function applyDevDnsServers() {
  if (process.env.NODE_ENV === "production") return;
  const servers = (process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    dns.setServers(servers);
  } catch (error) {
    console.warn("[db] Could not set DNS servers:", error);
  }
}

applyDevDnsServers();

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  connectedDatabaseName: string | null;
  connectionEventsRegistered: boolean;
  lastVerifiedAt: number;
  reconnectPromise: Promise<typeof mongoose> | null;
  suppressDisconnectReset: boolean;
  dbOperationChain: Promise<unknown>;
  dbWorkDepth: number;
  readyPromise: Promise<void> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

function createMongooseCache(): MongooseCache {
  return {
    conn: null,
    promise: null,
    connectedDatabaseName: null,
    connectionEventsRegistered: false,
    lastVerifiedAt: 0,
    reconnectPromise: null,
    suppressDisconnectReset: false,
    dbOperationChain: Promise.resolve(),
    dbWorkDepth: 0,
    readyPromise: null,
  };
}

function ensureMongooseCache(): MongooseCache {
  const existing = global.mongooseCache;
  if (
    existing &&
    "dbOperationChain" in existing &&
    existing.dbOperationChain instanceof Promise
  ) {
    return existing;
  }

  const next = createMongooseCache();
  if (existing) {
    next.conn = existing.conn ?? null;
    next.promise = existing.promise ?? null;
    next.readyPromise =
      "readyPromise" in existing && existing.readyPromise instanceof Promise
        ? existing.readyPromise
        : null;
  }
  global.mongooseCache = next;
  return next;
}

const cached = ensureMongooseCache();

const RUN_WITH_DATABASE_ATTEMPTS = 5;

/** Per-request marker so nested calls skip retry/connect setup without affecting other requests. */
const dbContext = new AsyncLocalStorage<boolean>();

/** True while a `runWithDatabase` / `runQueuedDatabaseWork` handler is executing. */
export function isInDatabaseContext() {
  return dbContext.getStore() === true;
}

/**
 * Runs DB work concurrently (the driver pool bounds parallelism). It used to chain every call
 * onto one global promise, which serialized all requests on an instance.
 */
function runQueuedDatabaseWork<T>(work: () => Promise<T>): Promise<T> {
  return dbContext.run(true, work);
}

function registerConnectionEvents() {
  if (cached.connectionEventsRegistered) return;
  cached.connectionEventsRegistered = true;

  mongoose.connection.on("disconnected", () => {
    cached.lastVerifiedAt = 0;
    if (!cached.suppressDisconnectReset) {
      resetCachedConnection();
    }
  });
  mongoose.connection.on("error", () => {
    cached.lastVerifiedAt = 0;
    if (!cached.suppressDisconnectReset) {
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
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
    socketTimeoutMS: 45_000,
    // Small pool so Promise.all queries run in parallel; override with MONGODB_MAX_POOL_SIZE.
    // Keep (instances x pool) under the Atlas Free tier's 500-connection limit.
    maxPoolSize: Math.max(1, Number(process.env.MONGODB_MAX_POOL_SIZE) || 5),
    minPoolSize: 0,
    // Fail fast when disconnected so runWithDatabase can retry instead of buffering 10s per query.
    bufferCommands: false,
  };
}

function isConnectionReady() {
  return mongoose.connection.readyState === 1;
}

function isTransientConnectionError(error: unknown) {
  return isInfrastructureError(error);
}

/** Exported for API routes to return 503 on connectivity failures. */
export function isDatabaseConnectivityError(error: unknown) {
  return isTransientConnectionError(error);
}

function resetCachedConnection() {
  cached.conn = null;
  cached.promise = null;
  cached.connectedDatabaseName = null;
  cached.readyPromise = null;
}

/** Wait until MongoDB is connected — shared by nested handlers and logging during cold start. */
export async function waitForDatabaseConnection(dbNameOverride?: string): Promise<void> {
  if (!cached.readyPromise) {
    cached.readyPromise = ensureDatabaseReady(dbNameOverride).catch((error) => {
      cached.readyPromise = null;
      throw error;
    });
  }
  await cached.readyPromise;
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

/** Reuse a live mongoose singleton after Turbopack HMR reloads this module. */
function adoptExistingConnection(targetDatabaseName: string) {
  if (!isConnectionReady()) return false;

  const activeName = mongoose.connection.name?.trim();
  if (!activeName || activeName !== targetDatabaseName) return false;

  cached.connectedDatabaseName = targetDatabaseName;
  cached.conn = mongoose;
  if (!cached.promise) {
    cached.promise = Promise.resolve(mongoose);
  }
  return true;
}

async function verifyConnectionAlive() {
  if (!isConnectionReady()) return false;

  try {
    await mongoose.connection.db?.admin().ping();
    cached.lastVerifiedAt = Date.now();
    return true;
  } catch {
    cached.lastVerifiedAt = 0;
    return false;
  }
}

async function ensureDatabaseReady(dbNameOverride?: string) {
  await connectToDatabaseOnce(dbNameOverride);
  if (await verifyConnectionAlive()) return;

  cached.lastVerifiedAt = 0;
  resetCachedConnection();
  await connectToDatabaseOnce(dbNameOverride);
  if (!(await verifyConnectionAlive())) {
    throw new Error("MongoDB connection is not ready.");
  }
}

async function openMongoConnection(
  mongodbUri: string,
  dbNameOverride?: string,
): Promise<typeof mongoose> {
  if (cached.reconnectPromise) {
    return cached.reconnectPromise;
  }

  cached.reconnectPromise = (async () => {
    cached.suppressDisconnectReset = true;
    try {
      const targetDatabaseName = resolveDatabaseName(dbNameOverride);
      if (adoptExistingConnection(targetDatabaseName) && (await verifyConnectionAlive())) {
        return mongoose;
      }

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
        } catch {
          // Stale or half-open sockets can throw during teardown.
        }
      }

      resetCachedConnection();
      cached.connectedDatabaseName = targetDatabaseName;
      const conn = await mongoose.connect(mongodbUri, getMongoOptions(dbNameOverride));
      cached.conn = conn;
      cached.promise = Promise.resolve(conn);
      cached.lastVerifiedAt = Date.now();
      return conn;
    } finally {
      cached.suppressDisconnectReset = false;
      cached.reconnectPromise = null;
    }
  })();

  return cached.reconnectPromise;
}

async function connectToDatabaseOnce(dbNameOverride?: string): Promise<typeof mongoose> {
  const mongodbUri = getMongoUri();
  const targetDatabaseName = resolveDatabaseName(dbNameOverride);

  applyDevDnsServers();
  registerConnectionEvents();

  if (adoptExistingConnection(targetDatabaseName) && (await verifyConnectionAlive())) {
    return mongoose;
  }

  if (
    isConnectionReady() &&
    cached.connectedDatabaseName === targetDatabaseName &&
    (await verifyConnectionAlive())
  ) {
    return mongoose;
  }

  if (!cached.promise) {
    cached.promise = openMongoConnection(mongodbUri, dbNameOverride).catch((error) => {
      resetCachedConnection();
      cached.lastVerifiedAt = 0;
      const reason = error instanceof Error ? error.message : "Unknown error";
      console.error("[db] MongoDB connection failed:", reason);
      throw new Error(
        `MongoDB connection failed: ${reason}. Check MONGODB_URI, Atlas network access (allow 0.0.0.0/0 for cloud deploys), and that the cluster is running.`,
      );
    });
  }

  try {
    const conn = await cached.promise;
    if (cached.connectedDatabaseName === targetDatabaseName && (await verifyConnectionAlive())) {
      return conn;
    }

    resetCachedConnection();
    return openMongoConnection(mongodbUri, dbNameOverride);
  } catch (error) {
    resetCachedConnection();
    cached.lastVerifiedAt = 0;
    throw error;
  }
}

export async function connectToDatabase(
  dbNameOverride?: string,
): Promise<typeof mongoose> {
  if (dbContext.getStore() === true) {
    await waitForDatabaseConnection(dbNameOverride);
    return mongoose;
  }

  return runQueuedDatabaseWork(async () => {
    await waitForDatabaseConnection(dbNameOverride);
    return mongoose;
  });
}

async function runWithDatabaseOnce<T>(
  fn: () => Promise<T>,
  dbNameOverride?: string,
): Promise<T> {
  const mongodbUri = getMongoUri();
  let lastError: unknown;

  for (let attempt = 0; attempt < RUN_WITH_DATABASE_ATTEMPTS; attempt++) {
    try {
      await waitForDatabaseConnection(dbNameOverride);
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < RUN_WITH_DATABASE_ATTEMPTS - 1 && isTransientConnectionError(error);
      if (!shouldRetry) break;

      cached.lastVerifiedAt = 0;
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
  if (dbContext.getStore() === true) {
    await waitForDatabaseConnection(dbNameOverride);
    return fn();
  }
  return runQueuedDatabaseWork(() => runWithDatabaseOnce(fn, dbNameOverride));
}

export async function disconnectFromDatabase() {
  return runQueuedDatabaseWork(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    cached.lastVerifiedAt = 0;
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
