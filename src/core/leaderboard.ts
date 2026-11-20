// TICKET-04: local leaderboard rules. Pure: no DOM, no fs. Shared by the web client and the CLI.

export const LEADERBOARD_SIZE = 10;
export const NAME_PATTERN = /^[A-Za-z0-9_]{3,12}$/;

export interface LeaderboardEntry {
  name: string;
  /** Sum of scores of the nights won (see tuning.score). */
  score: number;
  nights_won: number;
  /** ISO 8601 with timezone, e.g. 2026-11-20T10:00:00+07:00. */
  achieved_at: string;
  seed: number;
}

const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Returns null when valid, otherwise the reason it is rejected. */
export function validateEntry(e: LeaderboardEntry): string | null {
  if (!NAME_PATTERN.test(e.name)) return "name must be 3-12 characters of A-Z, a-z, 0-9 or _";
  if (!Number.isInteger(e.score) || e.score < 0) return "score must be a non-negative integer";
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) return "nights_won must be 0-3";
  if (!ISO_TZ.test(e.achieved_at) || Number.isNaN(Date.parse(e.achieved_at))) return "achieved_at must be ISO 8601 with timezone";
  if (!Number.isInteger(e.seed)) return "seed must be an integer";
  return null;
}

/** Sort: score descending; equal score -> earlier achieved_at first. */
export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
}

/** Adds an entry and keeps the top LEADERBOARD_SIZE. Input list is not mutated. */
export function insertEntry(list: readonly LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  const err = validateEntry(entry);
  if (err) throw new Error(err);
  return [...list, entry].sort(compareEntries).slice(0, LEADERBOARD_SIZE);
}

/** Parses the stored JSON. Malformed or invalid rows are dropped, never trusted. */
export function parseLeaderboard(text: string): LeaderboardEntry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(rows)) return [];
  const valid = rows.filter((r): r is LeaderboardEntry => {
    if (typeof r !== "object" || r === null) return false;
    return validateEntry(r as LeaderboardEntry) === null;
  });
  return [...valid].sort(compareEntries).slice(0, LEADERBOARD_SIZE);
}

export function serializeLeaderboard(list: readonly LeaderboardEntry[]): string {
  return JSON.stringify({ entries: list.slice(0, LEADERBOARD_SIZE) }, null, 2) + "\n";
}
