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
const recentChanges = git(["log", "-5", "--pretty=format:%s"])
  .split(/\r?\n/)
  .map((message) => message.trim())
  .filter(Boolean);
const primaryMessage = process.env.COMMIT_MSG || recentChanges[0] || "New app update";
const payload = {
  buildId,
  shortHash: buildId.slice(0, 7),
  branch: process.env.BRANCH || git(["rev-parse", "--abbrev-ref", "HEAD"]) || null,
  message: primaryMessage,
  changes: Array.from(new Set([primaryMessage, ...recentChanges])).slice(0, 5),
  author: git(["log", "-1", "--pretty=%an"]) || null,
  committedAt: git(["log", "-1", "--pretty=%cI"]) || null,
  builtAt: new Date().toISOString()
};

mkdirSync("dist", { recursive: true });
writeFileSync(join("dist", "build-info.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote dist/build-info.json for ${payload.shortHash}`);
