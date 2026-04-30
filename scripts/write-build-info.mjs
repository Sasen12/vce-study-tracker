import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const git = (args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
};

const buildId = process.env.COMMIT_REF || git(["rev-parse", "HEAD"]) || `local-${Date.now()}`;
const publicMessage = process.env.PUBLIC_RELEASE_MESSAGE || "Study Tracker was updated";
const publicChanges = (process.env.PUBLIC_RELEASE_CHANGES || "App improvements and fixes are ready after reload")
  .split("|")
  .map((message) => message.trim())
  .filter(Boolean);
const payload = {
  buildId,
  shortHash: buildId.slice(0, 7),
  message: publicMessage,
  changes: publicChanges.length ? publicChanges.slice(0, 5) : [publicMessage],
  committedAt: git(["log", "-1", "--pretty=%cI"]) || null,
  builtAt: new Date().toISOString()
};

mkdirSync("dist", { recursive: true });
writeFileSync(join("dist", "build-info.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote dist/build-info.json for ${payload.shortHash}`);
