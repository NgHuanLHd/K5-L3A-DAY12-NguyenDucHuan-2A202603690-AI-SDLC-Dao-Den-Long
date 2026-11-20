import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContract, runHeadless, simulate } from "../src/headless/run.js";
import { parseInputs } from "../src/headless/parse.js";

const contract = loadContract();
const tmp = mkdtempSync(join(tmpdir(), "ddl-"));
const quiet = () => {};

function run(args: string[]): { code: number; lines: Record<string, unknown>[] } {
  const out = join(tmp, `out-${Math.random().toString(36).slice(2)}.jsonl`);
  const code = runHeadless([...args, "--out", out], quiet);
  if (code !== 0) return { code, lines: [] };
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  return { code, lines };
}

function file(name: string, data: unknown): string {
  const p = join(tmp, name);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data));
  return p;
}

describe("Test Contract: output shape", () => {
  it("first line is snapshot tick 0, last line is end", () => {
    const { code, lines } = run(["--seed", "1", "--night", "1", "--ticks", "60"]);
    expect(code).toBe(0);
    expect(lines[0]).toMatchObject({ type: "snapshot", tick: 0, sim_tick: 0, state: "playing" });
    expect(lines.at(-1)).toEqual({ type: "end", ticks: 60, state: "playing", score: 0 });
  });

  it("snapshots every N ticks (default 10)", () => {
    const { lines } = run(["--seed", "1", "--night", "1", "--ticks", "35"]);
    const ticks = lines.filter((l) => l.type === "snapshot").map((l) => l.tick);
    expect(ticks).toEqual([0, 10, 20, 30]);
    const custom = run(["--seed", "1", "--night", "1", "--ticks", "10", "--snapshot-every", "5"]).lines;
    expect(custom.filter((l) => l.type === "snapshot").map((l) => l.tick)).toEqual([0, 5, 10]);
  });

  it("snapshot has 5 lanterns L1..L5 and time_left_s = duration - steps/60", () => {
    const { lines } = run(["--seed", "1", "--night", "1", "--ticks", "60"]);
    const snap = lines.filter((l) => l.type === "snapshot").at(-1) as { lanterns: { id: string }[]; time_left_s: number };
    expect(snap.lanterns.map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4", "L5"]);
    expect(snap.time_left_s).toBeCloseTo(contract.tuning.night1_duration_s - 1, 3);
  });
});

describe("Test Contract: determinism", () => {
  it("same seed + inputs => identical output", () => {
    const frames = parseInputs(JSON.stringify({ frames: [{ tick: 0, move: [0.3, 1] }, { tick: 30, jump: true }] }));
    const a = simulate(contract, { seed: 42, ticks: 300, snapshotEvery: 10, frames });
    const b = simulate(contract, { seed: 42, ticks: 300, snapshotEvery: 10, frames });
    expect(a.join("\n")).toBe(b.join("\n"));
  });

  it("different seed changes random motes", () => {
    const a = simulate(contract, { seed: 1, ticks: 0, snapshotEvery: 10 });
    const b = simulate(contract, { seed: 2, ticks: 0, snapshotEvery: 10 });
    expect(a[0]).not.toBe(b[0]);
  });
});

describe("Test Contract: inputs model", () => {
  const speed = contract.tuning.player_speed;
  const posAfter = (frames: unknown, ticks = 60) => {
    const { lines } = run(["--seed", "1", "--night", "1", "--ticks", String(ticks), "--inputs", file("in.json", { frames })]);
    return (lines.filter((l) => l.type === "snapshot").at(-1) as { player: { pos: number[] } }).player.pos;
  };

  it("move [0,1] at yaw 0 goes +Z at player_speed", () => {
    const p = posAfter([{ tick: 0, move: [0, 1] }]);
    expect(p[0]).toBeCloseTo(0, 3);
    expect(p[2]).toBeCloseTo(speed, 3);
  });

  it("cam_yaw_deg 90 rotates [0,1] to +X", () => {
    const p = posAfter([{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }]);
    expect(p[0]).toBeCloseTo(speed, 3);
    expect(p[2]).toBeCloseTo(0, 3);
  });

  it("move longer than 1 is normalised", () => {
    const p = posAfter([{ tick: 0, move: [1, 1] }]);
    // Each output coordinate is rounded to 3 decimals, so compare per axis.
    expect(p[0]).toBeCloseTo(speed / Math.SQRT2, 3);
    expect(p[2]).toBeCloseTo(speed / Math.SQRT2, 3);
  });

  it("absent fields keep previous values", () => {
    const p = posAfter([{ tick: 0, move: [0, 1] }, { tick: 30, jump: true }]);
    expect(p[2]).toBeCloseTo(speed, 3);
  });

  it("scenario time_left_s ends the night with game_over dawn", () => {
    const sc = file("sc.json", { time_left_s: 0.5, random_motes: false });
    const { lines } = run(["--seed", "1", "--night", "1", "--ticks", "600", "--scenario", sc]);
    const over = lines.find((l) => l.name === "game_over");
    expect(over).toMatchObject({ tick: 30, data: { result: "lost", reason: "dawn" } });
    expect(lines.at(-1)).toMatchObject({ type: "end", ticks: 30, state: "lost" });
  });
});

describe("Test Contract: errors", () => {
  it("bad inputs JSON => exit 2", () => {
    expect(run(["--seed", "1", "--night", "1", "--ticks", "5", "--inputs", file("bad.json", "{oops")]).code).toBe(2);
  });
  it("non-increasing ticks => exit 2", () => {
    const f = file("dup.json", { frames: [{ tick: 5 }, { tick: 5 }] });
    expect(run(["--seed", "1", "--night", "1", "--ticks", "5", "--inputs", f]).code).toBe(2);
  });
  it("move out of range => exit 2", () => {
    const f = file("range.json", { frames: [{ tick: 0, move: [2, 0] }] });
    expect(run(["--seed", "1", "--night", "1", "--ticks", "5", "--inputs", f]).code).toBe(2);
  });
  it("bad scenario => exit 2", () => {
    expect(run(["--seed", "1", "--night", "1", "--ticks", "5", "--scenario", file("bs.json", { motes: [[1, 2]] })]).code).toBe(2);
  });
  it("missing --ticks => non-zero", () => {
    expect(run(["--seed", "1", "--night", "1"]).code).not.toBe(0);
  });
});
