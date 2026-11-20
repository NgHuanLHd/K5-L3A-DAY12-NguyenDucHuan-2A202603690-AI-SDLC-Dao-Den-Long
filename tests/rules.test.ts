// Phase 1 rules. Expected values are derived from the spec + game.contract.json tuning,
// never copied from program output.
import { describe, expect, it } from "vitest";
import { ISLAND_RADIUS, TICK_RATE } from "../src/core/constants.js";
import type { Scenario } from "../src/core/types.js";
import { parseInputs, type Frame } from "../src/headless/parse.js";
import { loadContract, simulate } from "../src/headless/run.js";

const T = loadContract().tuning;
type Line = Record<string, any>;

/** Quiet scenario: no random motes/shades unless the test adds them. */
function sim(scenario: Scenario, frames: unknown[] = [], ticks = 60, every = 1): Line[] {
  const parsed: Frame[] = parseInputs(JSON.stringify({ frames }));
  return simulate(loadContract(), {
    seed: 1,
    ticks,
    snapshotEvery: every,
    scenario: { random_motes: false, random_shades: false, ...scenario },
    frames: parsed,
  }).map((l) => JSON.parse(l));
}
const events = (lines: Line[], name?: string) => lines.filter((l) => l.type === "event" && (!name || l.name === name));
const lastSnap = (lines: Line[]) => lines.filter((l) => l.type === "snapshot").at(-1)!;
const snapAt = (lines: Line[], tick: number) => lines.find((l) => l.type === "snapshot" && l.tick === tick)!;
const end = (lines: Line[]) => lines.at(-1)!;
const press = (key: string, tick = 0) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const dxz = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!);

describe("Scenario setup", () => {
  it("emits no events and awards no points (lit lantern preset)", () => {
    const lines = sim({ lanterns: [{ id: "L1", lit: true }], player: { carried: 2 } }, [], 1);
    expect(events(lines)).toEqual([]);
    expect(snapAt(lines, 0)).toMatchObject({ score: 0, player: { carried: 2 } });
    expect(snapAt(lines, 0).lanterns[0]).toMatchObject({ id: "L1", lit: true });
  });
});

describe("Island boundary (fall_enabled = false)", () => {
  it("player never leaves the island", () => {
    const lines = sim({}, [{ tick: 0, move: [0, 1] }], 60 * 20, 60);
    for (const s of lines.filter((l) => l.type === "snapshot")) {
      expect(Math.hypot(s.player.pos[0], s.player.pos[2])).toBeLessThanOrEqual(ISLAND_RADIUS + 1e-3);
    }
    expect(events(lines, "player_hit")).toEqual([]);
  });
});

describe("Motes", () => {
  it("picks a mote exactly at pickup_radius (<= r) on the first step", () => {
    const lines = sim({ motes: [[0, 0, T.pickup_radius]] }, [], 2);
    expect(events(lines, "mote_picked")).toEqual([{ type: "event", tick: 1, name: "mote_picked", data: { carried: 1 } }]);
    expect(snapAt(lines, 1)).toMatchObject({ score: T.score.per_mote, motes_active: 0, player: { carried: 1 } });
  });

  it("does not pick a mote just outside pickup_radius", () => {
    const lines = sim({ motes: [[0, 0, T.pickup_radius + 0.01]] }, [], 10);
    expect(events(lines, "mote_picked")).toEqual([]);
  });

  it("does not exceed carry_capacity", () => {
    const lines = sim({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }, [], 10);
    expect(events(lines, "mote_picked")).toEqual([]);
    expect(lastSnap(lines)).toMatchObject({ motes_active: 1, player: { carried: T.carry_capacity } });
  });

  it("walking into a mote picks it", () => {
    // 1 s at player_speed covers player_speed metres along +Z.
    const lines = sim({ motes: [[0, 0, T.player_speed / 2]] }, [{ tick: 0, move: [0, 1] }], 60);
    expect(events(lines, "mote_picked")).toHaveLength(1);
  });
});

describe("Lanterns", () => {
  const near = { id: "L1", pos: [0, 0, T.interact_radius] as [number, number, number] };

  it("interact deposits up to lantern_cost and lights the lantern", () => {
    const lines = sim({ player: { carried: T.lantern_cost }, lanterns: [near] }, press("interact"), 3);
    expect(events(lines).map((e) => [e.tick, e.name, e.data])).toEqual([
      [1, "deposit", { lantern_id: "L1", amount: T.lantern_cost, deposited: T.lantern_cost }],
      [1, "lantern_lit", { lantern_id: "L1" }],
    ]);
    expect(snapAt(lines, 1)).toMatchObject({ score: T.score.per_lantern, player: { carried: 0 } });
    expect(snapAt(lines, 1).lanterns[0]).toMatchObject({ lit: true, deposited: T.lantern_cost });
  });

  it("partial deposit accumulates without lighting", () => {
    const lines = sim({ player: { carried: 1 }, lanterns: [near] }, press("interact"), 3);
    expect(events(lines).map((e) => e.name)).toEqual(["deposit"]);
    expect(events(lines)[0]!.data).toEqual({ lantern_id: "L1", amount: 1, deposited: 1 });
  });

  it("only deposits what the lantern still needs", () => {
    const lines = sim({ player: { carried: T.lantern_cost + 1 }, lanterns: [{ ...near, deposited: T.lantern_cost - 1 }] }, press("interact"), 3);
    expect(events(lines, "deposit")[0]!.data).toEqual({ lantern_id: "L1", amount: 1, deposited: T.lantern_cost });
    expect(snapAt(lines, 1).player.carried).toBe(T.lantern_cost);
  });

  it("interact out of range or with nothing carried does nothing", () => {
    const far = sim({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, T.interact_radius + 0.01] }] }, press("interact"), 3);
    expect(events(far)).toEqual([]);
    const empty = sim({ player: { carried: 0 }, lanterns: [near] }, press("interact"), 3);
    expect(events(empty)).toEqual([]);
  });

  it("holding interact triggers only once (false -> true edge)", () => {
    const lines = sim({ player: { carried: 2 }, lanterns: [near] }, [{ tick: 0, interact: true }], 30);
    expect(events(lines, "deposit")).toHaveLength(1);
  });

  it("lighting the last lantern wins with time + flame bonus", () => {
    const lit = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
    const lines = sim({ player: { carried: T.lantern_cost, flames: 2 }, lanterns: [near, ...lit], time_left_s: 100 }, press("interact"), 60);
    expect(events(lines).map((e) => e.name)).toEqual(["deposit", "lantern_lit", "game_over"]);
    expect(events(lines, "game_over")[0]).toMatchObject({ tick: 1, data: { result: "won", reason: "all_lit" } });
    // time_left after step 1 = 100 - 1/60 -> 99 whole seconds.
    const expected = T.score.per_lantern + 99 * T.score.per_second_left + 2 * T.score.per_flame_left;
    expect(end(lines)).toEqual({ type: "end", ticks: 1, state: "won", score: expected });
  });
});

describe("Shades", () => {
  it("chase the player at shade_speed", () => {
    const lines = sim({ shades: [{ id: "S1", pos: [10, 0, 0] }] }, [], 60);
    const s = lastSnap(lines).shades[0];
    expect(s.state).toBe("chase");
    expect(s.pos[0]).toBeCloseTo(10 - T.shade_speed, 2);
  });

  it("touching the player costs a flame, drops light and grants invulnerability", () => {
    const lines = sim({ player: { carried: 4 }, shades: [{ id: "S1", pos: [0, 0, T.shade_hit_radius] }] }, [], 3 * TICK_RATE);
    const hits = events(lines, "player_hit");
    expect(hits[0]).toMatchObject({ tick: 1, data: { by: "shade", flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) } });
    expect(hits[1]!.tick - hits[0]!.tick).toBe(Math.round(T.invuln_s * TICK_RATE));
  });

  it("losing all flames ends the game (no_flames)", () => {
    const lines = sim({ player: { flames: 1 }, shades: [{ id: "S1", pos: [0, 0, 0] }] }, [], 60);
    expect(events(lines).map((e) => e.name)).toEqual(["player_hit", "game_over"]);
    expect(events(lines, "game_over")[0]!.data).toEqual({ result: "lost", reason: "no_flames" });
    expect(end(lines)).toMatchObject({ ticks: 1, state: "lost" });
  });

  it("never enter a lit lantern's safe_radius, so a player there is safe", () => {
    const L = [0, 0, 20];
    const lines = sim(
      { player: { pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: L as never, lit: true }], shades: [{ id: "S1", pos: [0, 0, 5] }] },
      [],
      10 * TICK_RATE,
    );
    for (const s of lines.filter((l) => l.type === "snapshot")) expect(dxz(s.shades[0].pos, L)).toBeGreaterThan(T.safe_radius);
    expect(events(lines, "player_hit")).toEqual([]);
  });

  it("unlit lanterns do not protect", () => {
    const lines = sim({ player: { pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: [0, 0, 20] }], shades: [{ id: "S1", pos: [0, 0, 18] }] }, [], 2 * TICK_RATE);
    expect(events(lines, "player_hit").length).toBeGreaterThan(0);
  });

  it("random shades spawn over time; random_shades:false keeps none", () => {
    const lines = simulate(loadContract(), { seed: 3, ticks: 40 * TICK_RATE, snapshotEvery: 60 }).map((l) => JSON.parse(l));
    const spawned = events(lines, "shade_spawned");
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned[0]!.data.id).toMatch(/^S\d+$/);
    const none = sim({}, [], 40 * TICK_RATE, 600);
    expect(events(none, "shade_spawned")).toEqual([]);
  });
});

describe("Pulse", () => {
  it("costs pulse_cost, stuns and pushes shades within pulse_radius, scores per_stun", () => {
    const start = [0, 0, T.pulse_radius];
    const lines = sim({ player: { carried: T.pulse_cost + 1 }, shades: [{ id: "S1", pos: start as never }, { id: "S2", pos: [0, 0, -(T.pulse_radius + 1)] }] }, press("pulse"), 2);
    expect(events(lines, "pulse")).toEqual([{ type: "event", tick: 1, name: "pulse", data: { stunned_ids: ["S1"] } }]);
    const s1 = snapAt(lines, 1).shades.find((s: Line) => s.id === "S1");
    expect(s1.state).toBe("stunned");
    expect(s1.pos[2]).toBeCloseTo(T.pulse_radius + T.pulse_push_m, 3);
    expect(snapAt(lines, 1)).toMatchObject({ score: T.score.per_stun, player: { carried: 1 } });
  });

  it("stunned shades do not move or hit, then recover after pulse_stun_s", () => {
    const lines = sim({ player: { carried: 1 }, shades: [{ id: "S1", pos: [0, 0, 0.5] }] }, press("pulse"), Math.round(T.pulse_stun_s * TICK_RATE) + 5);
    expect(events(lines, "player_hit")).toEqual([]);
    const stunTicks = Math.round(T.pulse_stun_s * TICK_RATE);
    expect(snapAt(lines, stunTicks).shades[0].state).toBe("stunned");
    expect(snapAt(lines, stunTicks + 1).shades[0].state).toBe("chase");
  });

  it("respects pulse_cooldown_s", () => {
    const cd = Math.round(T.pulse_cooldown_s * TICK_RATE);
    const frames = [...press("pulse", 0), ...press("pulse", 10), ...press("pulse", cd + 2)];
    const lines = sim({ player: { carried: 5 } }, frames, cd + 10);
    expect(events(lines, "pulse").map((e) => e.tick)).toEqual([1, cd + 3]);
  });

  it("does nothing without enough light", () => {
    const lines = sim({ player: { carried: T.pulse_cost - 1 }, shades: [{ id: "S1", pos: [0, 0, 2] }] }, press("pulse"), 2);
    expect(events(lines, "pulse")).toEqual([]);
  });
});

describe("Full night determinism", () => {
  it("random run with inputs is byte-identical across runs", () => {
    const frames = parseInputs(JSON.stringify({
      frames: [{ tick: 0, move: [0.4, 1] }, { tick: 300, move: [-1, 0.2], pulse: true }, { tick: 301, pulse: false }, { tick: 900, interact: true }],
    }));
    const run = () => simulate(loadContract(), { seed: 99, ticks: 3000, snapshotEvery: 10, frames }).join("\n");
    expect(run()).toBe(run());
  });
});
