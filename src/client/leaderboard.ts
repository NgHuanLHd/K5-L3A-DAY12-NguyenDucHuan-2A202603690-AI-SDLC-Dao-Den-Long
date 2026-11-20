// Client side of the local leaderboard. Talks to the server started by `npm start` (scripts/serve.mjs).
// Every call returns a safe value when the server is missing, so the game never breaks without it.
import { parseLeaderboard, type LeaderboardEntry } from "../core/leaderboard.js";

const API = "/api/leaderboard";

/** Entries, or null when the server cannot be reached. */
export async function loadBoard(): Promise<LeaderboardEntry[] | null> {
  try {
    const r = await fetch(API, { cache: "no-store" });
    if (!r.ok) return null;
    return parseLeaderboard(await r.text());
  } catch {
    return null;
  }
}

/** Returns null on success, otherwise a message to show the player. */
export async function postScore(entry: LeaderboardEntry): Promise<string | null> {
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (r.ok) return null;
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    return body.error ?? "Không lưu được điểm.";
  } catch {
    return "Không kết nối được máy chủ bảng xếp hạng. Chạy game bằng npm start để lưu điểm.";
  }
}
