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

let connectedDatabaseName: string | null = null;

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
    maxIdleTimeMS: 10_000,
    bufferCommands: false,
  };
}

function isConnectionReady(conn: typeof mongoose) {
  return conn.connection.readyState === 1;
}

function resetCachedConnection() {
  cached.conn = null;
  cached.promise = null;
  connectedDatabaseName = null;
}

export async function connectToDatabase(dbNameOverride?: string) {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    throw new Error(
      "Please set MONGODB_URI in your environment (for Vercel: Project Settings → Environment Variables).",
    );
  }

  const targetDatabaseName = resolveDatabaseName(dbNameOverride);
  const hasMatchingConnection =
    cached.conn &&
    isConnectionReady(cached.conn) &&
    connectedDatabaseName === targetDatabaseName;

  if (hasMatchingConnection && cached.conn) {
    return cached.conn;
  }

  if (cached.conn) {
    await mongoose.disconnect();
    resetCachedConnection();
  }

  if (!cached.promise) {
    connectedDatabaseName = targetDatabaseName;
    cached.promise = mongoose
      .connect(mongodbUri, getMongoOptions(dbNameOverride))
      .then((conn) => {
        cached.conn = conn;
        return conn;
      })
      .catch((error) => {
        resetCachedConnection();
        const reason = error instanceof Error ? error.message : "Unknown error";
        console.error("[db] MongoDB connection failed:", reason);
        throw new Error(
          `MongoDB connection failed: ${reason}. Check MONGODB_URI, Atlas network access (allow 0.0.0.0/0 for cloud deploys), and that the cluster is running.`,
        );
      });
  }

  return cached.promise;
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  resetCachedConnection();
}

export async function getDatabaseHealth() {
  try {
    const conn = await connectToDatabase();
    await conn.connection.db?.admin().ping();
    return {
      ok: true as const,
      dbName: conn.connection.name,
      readyState: conn.connection.readyState,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Database connection failed.",
      hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
      dbName: process.env.MONGODB_DB ?? "ccf_pickleball",
    };
  }
}
