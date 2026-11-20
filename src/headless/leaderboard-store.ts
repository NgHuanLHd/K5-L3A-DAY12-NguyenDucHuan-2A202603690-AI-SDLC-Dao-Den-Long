import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLeaderboard, serializeLeaderboard, type LeaderboardEntry } from "../core/leaderboard.js";

/** Default file: <repo>/data/leaderboard.json. Override with DDL_LEADERBOARD. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function leaderboardPath(): string {
  return process.env["DDL_LEADERBOARD"] ? resolve(process.env["DDL_LEADERBOARD"]) : resolve(ROOT, "data", "leaderboard.json");
}

export function readLeaderboard(path = leaderboardPath()): LeaderboardEntry[] {
  if (!existsSync(path)) return [];
  return parseLeaderboard(readFileSync(path, "utf8"));
}

export function writeLeaderboard(list: LeaderboardEntry[], path = leaderboardPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeLeaderboard(list), "utf8");
}
