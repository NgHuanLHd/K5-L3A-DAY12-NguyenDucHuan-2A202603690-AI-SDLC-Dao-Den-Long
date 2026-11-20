// Test Contract v1.1: CLI, output shape, determinism, errors, performance.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseInputs } from "../src/headless/parse.js";
import { loadContract, runHeadless, simulate } from "../src/headless/run.js";
import { contract, T } from "./helpers.js";

const tmp = mkdtempSync(join(tmpdir(), "ddl-"));
const quiet = () => {};
let n = 0;

function run(args: string[]): { code: number; lines: Record<string, any>[] } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out = join(tmp, `out-${n++}.jsonl`);
  const code = runHeadless([...args, "--out", out], quiet);
  if (code !== 0) return { code, lines: [] };
  return { code, lines: readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l)) };
}
function file(name: string, data: unknown): string {
  const p = join(tmp, name);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data));
  return p;
}

describe("contract file v1.1", () => {
  it("has the v1.1 fields and the standard numbers", () => {
    expect(contract.contract_version).toBe("1.1");
    expect(Object.keys(T).sort()).toEqual(
      ["player_speed","carry_capacity","lantern_cost","lantern_count_night1","pickup_radius","interact_radius","pulse_cost","pulse_radius","night1_duration_s","flames","invuln_s","hit_drop_ratio","pulse_stun_s","pulse_push_m","pulse_cooldown_s","safe_radius","shade_speed","shade_hit_radius","fall_enabled","score","dash_speed","dash_duration_s","dash_cooldown_s","night2_duration_s","night3_duration_s"].sort(),
    );
    expect(T).toMatchObject({
      player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
      pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3,
      invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4,
      shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
      score: { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 },
    });
  });
});

describe("output shape", () => {
  it("snapshot 0, then night_start, ..., last line end", () => {
    const { code, lines } = run(["--seed", "1", "--night", "1", "--ticks", "60"]);
    expect(code).toBe(0);
    expect(lines[0]).toMatchObject({ type: "snapshot", tick: 0, sim_tick: 0, state: "playing", night: 1 });
    expect(lines[1]).toEqual({ type: "event", tick: 0, name: "night_start", data: { night: 1 } });
    expect(lines.at(-1)).toEqual({ type: "end", ticks: 60, state: "playing", score: 0 });
  });
  it("snapshot carries every v1.1 field", () => {
    for (const night of [1, 2, 3]) {
      const s = run(["--seed", "1", "--night", String(night), "--ticks", "0"]).lines[0]!;
      for (const k of ["type","tick","sim_tick","state","night","time_left_s","score","wind","player","lanterns","shades","motes_active","motes","drifters","charms"]) expect(s).toHaveProperty(k);
      expect(s.wind).toEqual({ active: false, dir_deg: 0 });
      for (const k of ["pos","vel","grounded","invuln","dash_cd_s","pulse_cd_s","charm_s","flames","carried"]) expect(s.player).toHaveProperty(k);
      expect(s.player.vel).toEqual([0, 0, 0]);
      expect(s.player.grounded).toBe(true);
      for (const m of s.motes) for (const k of ["id","pos","kind","ttl_s"]) expect(m).toHaveProperty(k);
      expect(s.motes_active).toBe(s.motes.length);
      expect(s.night).toBe(night);
    }
  });
  it("snapshots every N ticks (default 10) from tick 0", () => {
    const ticks = run(["--seed", "1", "--night", "1", "--ticks", "35"]).lines.filter((l) => l.type === "snapshot").map((l) => l.tick);
    expect(ticks).toEqual([0, 10, 20, 30]);
    const custom = run(["--seed", "1", "--night", "1", "--ticks", "10", "--snapshot-every", "5"]).lines;
    expect(custom.filter((l) => l.type === "snapshot").map((l) => l.tick)).toEqual([0, 5, 10]);
  });
  it("lanterns per night: 5, 6, 7", () => {
    const counts = [1, 2, 3].map((night) => run(["--seed", "1", "--night", String(night), "--ticks", "0"]).lines[0]!.lanterns.length);
    expect(counts).toEqual([5, 6, 7]);
  });
  it("time_left_s = night duration - sim steps / 60", () => {
    const { lines } = run(["--seed", "1", "--night", "2", "--ticks", "60"]);
    expect(lines.filter((l) => l.type === "snapshot").at(-1)!.time_left_s).toBeCloseTo(T.night2_duration_s - 1, 6);
  });
  it("only contract event names, with the contract's data keys", () => {
    const keys: Record<string, string[]> = {
      mote_picked: ["carried"], deposit: ["lantern_id", "amount", "deposited"], lantern_lit: ["lantern_id"], pulse: ["stunned_ids"],
      player_hit: ["by", "flames", "dropped"], shade_spawned: ["id"], game_over: ["result", "reason"], dash: [],
      charm_picked: ["charm_id", "charm_ticks"], drifter_steal: ["drifter_id", "amount", "carried"], drifter_drop: ["drifter_id", "amount"],
      night_start: ["night"], paused: [], resumed: [],
    };
    for (const night of [1, 2, 3]) {
      const { lines } = run(["--seed", "7", "--night", String(night), "--ticks", "6000", "--inputs", file("w.json", { frames: [{ tick: 0, move: [0.4, 1] }, { tick: 120, dash: true }, { tick: 121, dash: false }, { tick: 200, pulse: true }, { tick: 201, pulse: false }] })]);
      for (const e of lines.filter((l) => l.type === "event")) {
        expect(Object.keys(keys)).toContain(e.name);
        const expected = e.name === "player_hit" && e.data.by === "fall" ? [...keys.player_hit!, "lost"] : keys[e.name]!;
        expect(Object.keys(e.data).sort()).toEqual([...expected].sort());
      }
    }
  });
});

describe("determinism", () => {
  it("same seed + scenario + inputs => identical bytes, for every night", () => {
    const frames = parseInputs(JSON.stringify({ frames: [{ tick: 0, move: [0.4, 1] }, { tick: 300, move: [-1, 0.2], pulse: true }, { tick: 301, pulse: false }, { tick: 900, interact: true }, { tick: 950, dash: true }] }));
    for (const night of [1, 2, 3]) {
      const go = () => simulate(contract, { seed: 99, night, ticks: 4000, snapshotEvery: 10, frames }).join("\n");
      expect(go()).toBe(go());
    }
  });
  it("different seeds differ", () => {
    const a = simulate(contract, { seed: 1, ticks: 0, snapshotEvery: 10 })[0];
    const b = simulate(contract, { seed: 2, ticks: 0, snapshotEvery: 10 })[0];
    expect(a).not.toBe(b);
  });
});

describe("errors", () => {
  it("bad inputs/scenario files => exit 2", () => {
    const base = ["--seed", "1", "--night", "1", "--ticks", "5"];
    expect(run([...base, "--inputs", file("bad.json", "{oops")]).code).toBe(2);
    expect(run([...base, "--inputs", file("dup.json", { frames: [{ tick: 5 }, { tick: 5 }] })]).code).toBe(2);
    expect(run([...base, "--inputs", file("range.json", { frames: [{ tick: 0, move: [2, 0] }] })]).code).toBe(2);
    expect(run([...base, "--inputs", file("pause.json", { frames: [{ tick: 0, pause: 1 }] })]).code).toBe(2);
    expect(run([...base, "--scenario", file("s1.json", { motes: [[1, 2]] })]).code).toBe(2);
    expect(run([...base, "--scenario", file("s2.json", { shades: [{ pos: [0, 0, 5], state: "angry" }] })]).code).toBe(2);
    expect(run([...base, "--scenario", file("s3.json", { drifters: [{ pos: [0, 1, 5], state: "dead" }] })]).code).toBe(2);
    expect(run([...base, "--scenario", file("s4.json", { charms: [{ pos: [0, 0, 0] }] })]).code).toBe(2);
    expect(run([...base, "--scenario", file("s5.json", { player: { charm_ticks: -1 } })]).code).toBe(2);
    expect(run([...base, "--scenario", join(tmp, "missing.json")]).code).toBe(2);
  });
  it("bad CLI usage => non-zero; --night accepts only 1, 2, 3", () => {
    expect(run(["--seed", "1", "--night", "1"]).code).not.toBe(0);
    expect(run(["--seed", "1", "--night", "4", "--ticks", "5"]).code).toBe(1);
    expect(run(["--seed", "1", "--night", "0", "--ticks", "5"]).code).toBe(1);
    for (const night of ["1", "2", "3"]) expect(run(["--seed", "1", "--night", night, "--ticks", "5"]).code).toBe(0);
  });
  it("accepts the v1.1 scenario fields", () => {
    const sc = {
      player: { pos: [0, 0, 0], carried: 2, flames: 2, invuln_ticks: 10, dash_cd_ticks: 5, pulse_cd_ticks: 7, charm_ticks: 100 },
      random_motes: false, random_shades: false, random_drifters: false, wind_enabled: true,
      motes: [[3, 0, 3], { pos: [4, 0, 4], kind: "dropped", ttl_s: 3 }],
      shades: [{ id: "S1", pos: [10, 1, 0], state: "recoil", state_ticks_left: 20 }],
      drifters: [{ id: "D1", pos: [8, 1.5, 0], state: "flee", stolen: 3, state_ticks_left: 50 }],
      charms: [{ id: "C1", pos: [9, 0, 9], available: false, respawn_ticks: 30 }],
      lanterns: [{ id: "L1", lit: true }], time_left_s: 99,
    };
    const { code, lines } = run(["--seed", "1", "--night", "2", "--ticks", "0", "--scenario", file("v11.json", sc)]);
    expect(code).toBe(0);
    const s = lines[0]!;
    expect(s.player).toMatchObject({ carried: 2, flames: 2, invuln: true, dash_cd_s: 0.083, pulse_cd_s: 0.117, charm_s: 1.667 });
    expect(s.motes.map((m: any) => [m.kind, m.ttl_s])).toEqual([["random", null], ["dropped", 3]]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(s.shades[0]).toMatchObject({ id: "S1", state: "recoil" });
    expect(s.drifters[0]).toMatchObject({ id: "D1", state: "flee", stolen: 3 });
    expect(s.charms).toEqual([{ id: "C1", available: false, respawn_s: 0.5 }]);
    expect(s.time_left_s).toBe(99);
    expect(s.score).toBe(0);
    expect(lines.filter((l) => l.type === "event").map((e) => e.name)).toEqual(["night_start"]);
  });
});

describe("performance", () => {
  it("a full Night (21 600 ticks) finishes far inside 30 s, every night", () => {
    for (const night of [1, 2, 3]) {
      const t0 = performance.now();
      const lines = simulate(contract, {
        seed: 5, night, ticks: 21600, snapshotEvery: 10,
        scenario: { player: { flames: 99999 } },
        frames: parseInputs(JSON.stringify({ frames: [{ tick: 0, move: [0.3, 1] }, { tick: 600, move: [-1, 0.5] }] })),
      });
      const ms = performance.now() - t0;
      expect(JSON.parse(lines.at(-1)!).ticks).toBeGreaterThan(0);
      expect(ms).toBeLessThan(30_000);
    }
  });
  it("loads the contract from any working directory", () => {
    expect(loadContract().contract_version).toBe("1.1");
  });
});
