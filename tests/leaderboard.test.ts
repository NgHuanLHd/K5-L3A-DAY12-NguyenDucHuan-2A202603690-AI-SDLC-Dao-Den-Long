// TICKET-04: local leaderboard rules (AC: name 3-12 [A-Za-z0-9_], top 10, score desc, earlier first on ties).
import { describe, expect, it } from "vitest";
import { insertEntry, parseLeaderboard, serializeLeaderboard, validateEntry, type LeaderboardEntry } from "../src/core/leaderboard.js";

const base: LeaderboardEntry = { name: "May_01", score: 100, nights_won: 1, achieved_at: "2026-11-20T10:00:00+07:00", seed: 1 };
const e = (over: Partial<LeaderboardEntry>): LeaderboardEntry => ({ ...base, ...over });

describe("validateEntry", () => {
  it("accepts a valid entry", () => {
    expect(validateEntry(base)).toBeNull();
  });
  it("name must be 3-12 of [A-Za-z0-9_]", () => {
    expect(validateEntry(e({ name: "ab" }))).not.toBeNull();
    expect(validateEntry(e({ name: "a".repeat(13) }))).not.toBeNull();
    expect(validateEntry(e({ name: "abc def" }))).not.toBeNull();
    expect(validateEntry(e({ name: "Mây" }))).not.toBeNull(); // accents not required
    expect(validateEntry(e({ name: "a".repeat(12) }))).toBeNull();
    expect(validateEntry(e({ name: "abc" }))).toBeNull();
  });
  it("nights_won is 0-3 and score is a non-negative integer", () => {
    expect(validateEntry(e({ nights_won: 4 }))).not.toBeNull();
    expect(validateEntry(e({ score: -1 }))).not.toBeNull();
    expect(validateEntry(e({ score: 1.5 }))).not.toBeNull();
  });
  it("achieved_at must be ISO 8601 with timezone", () => {
    expect(validateEntry(e({ achieved_at: "2026-11-20 10:00" }))).not.toBeNull();
    expect(validateEntry(e({ achieved_at: "2026-11-20T10:00:00" }))).not.toBeNull();
    expect(validateEntry(e({ achieved_at: "2026-11-20T10:00:00Z" }))).toBeNull();
  });
});

describe("insertEntry", () => {
  it("sorts by score descending and keeps at most 10", () => {
    let list: LeaderboardEntry[] = [];
    for (let i = 0; i < 12; i++) list = insertEntry(list, e({ name: `p${i}__`, score: i * 10, achieved_at: `2026-11-20T10:${String(i).padStart(2, "0")}:00+07:00` }));
    expect(list).toHaveLength(10);
    expect(list[0]!.score).toBe(110);
    expect(list[9]!.score).toBe(20);
  });
  it("ties: whoever achieved first stands higher", () => {
    const late = e({ name: "late_one", score: 200, achieved_at: "2026-11-20T12:00:00+07:00" });
    const early = e({ name: "early_1", score: 200, achieved_at: "2026-11-20T09:00:00+07:00" });
    const list = insertEntry(insertEntry([], late), early);
    expect(list.map((x) => x.name)).toEqual(["early_1", "late_one"]);
  });
  it("compares instants across timezones", () => {
    const a = e({ name: "tz_a__", score: 50, achieved_at: "2026-11-20T10:00:00+07:00" }); // 03:00Z
    const b = e({ name: "tz_b__", score: 50, achieved_at: "2026-11-20T04:00:00Z" }); // later
    expect(insertEntry([b], a)[0]!.name).toBe("tz_a__");
  });
  it("does not mutate the input and rejects invalid entries", () => {
    const list = [base];
    insertEntry(list, e({ name: "good_1" }));
    expect(list).toHaveLength(1);
    expect(() => insertEntry(list, e({ name: "a b" }))).toThrow();
  });
});

describe("parse/serialize", () => {
  it("round-trips the file format {entries: [...]}", () => {
    const text = serializeLeaderboard([base, e({ name: "second", score: 50 })]);
    expect(JSON.parse(text).entries).toHaveLength(2);
    expect(parseLeaderboard(text)).toEqual([base, e({ name: "second", score: 50 })]);
  });
  it("drops malformed and invalid rows instead of trusting them", () => {
    const text = JSON.stringify({ entries: [base, { name: "bad name", score: 1 }, null, e({ nights_won: 9 })] });
    expect(parseLeaderboard(text)).toEqual([base]);
  });
  it("returns an empty list for broken JSON or a missing entries array", () => {
    expect(parseLeaderboard("{not json")).toEqual([]);
    expect(parseLeaderboard('{"other": 1}')).toEqual([]);
  });
});
