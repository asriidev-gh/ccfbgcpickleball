import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheLinkPath = path.join(projectRoot, ".next", "dev", "cache", "turbopack");
const cacheTargetPath = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "ccf-pickleball-turbopack-cache",
);

function isWindowsJunction(entryPath) {
  if (process.platform !== "win32" || !fs.existsSync(entryPath)) return false;

  try {
    const output = execSync(`fsutil reparsepoint query "${entryPath}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.includes("Reparse Tag");
  } catch {
    return false;
  }
}

function createJunction() {
  fs.mkdirSync(path.dirname(cacheLinkPath), { recursive: true });
  fs.mkdirSync(cacheTargetPath, { recursive: true });
  fs.symlinkSync(cacheTargetPath, cacheLinkPath, "junction");
  console.log(`[dev-cache] Linked turbopack cache -> ${cacheTargetPath}`);
}

if (process.platform !== "win32") {
  process.exit(0);
}

if (fs.existsSync(cacheLinkPath)) {
  if (isWindowsJunction(cacheLinkPath)) {
    process.exit(0);
  }

  console.warn(
    "[dev-cache] .next/dev/cache/turbopack is a regular folder. Delete it to use the SSD cache:",
  );
  console.warn(`  Remove-Item -Recurse -Force "${cacheLinkPath}"`);
  process.exit(0);
}

try {
  createJunction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[dev-cache] Could not create junction: ${message}`);
  console.warn("[dev-cache] Continuing with a local turbopack cache.");
}
