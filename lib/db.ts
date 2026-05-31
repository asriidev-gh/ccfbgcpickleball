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

function getMongoOptions() {
  return {
    dbName: process.env.MONGODB_DB ?? "ccf_pickleball",
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    bufferCommands: false,
  };
}

function isConnectionReady(conn: typeof mongoose) {
  return conn.connection.readyState === 1;
}

function resetCachedConnection() {
  cached.conn = null;
  cached.promise = null;
}

export async function connectToDatabase() {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    throw new Error(
      "Please set MONGODB_URI in your environment (for Vercel: Project Settings → Environment Variables).",
    );
  }

  if (cached.conn && isConnectionReady(cached.conn)) {
    return cached.conn;
  }

  if (cached.conn && !isConnectionReady(cached.conn)) {
    resetCachedConnection();
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongodbUri, getMongoOptions())
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
