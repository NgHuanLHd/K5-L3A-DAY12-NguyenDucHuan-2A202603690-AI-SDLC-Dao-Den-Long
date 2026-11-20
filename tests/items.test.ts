// T4 + T5(part): motes, charm, lanterns, scoring, safe zones (TICKET-02 Part 1).
import { describe, expect, it } from "vitest";
import { getNight } from "../src/core/maps.js";
import { dxz, endLine, events, lastSnap, press, sim, snapAt, snaps, T } from "./helpers.js";

describe("Motes", () => {
  it("20 motes at the start, on 20 distinct standard points", () => {
    for (const night of [1, 2, 3]) {
      const lines = sim({ random_motes: true }, [], { night, ticks: 0 });
      const m = snapAt(lines, 0).motes;
      expect(m).toHaveLength(20);
      const points = getNight(night).motePoints.map((p) => p.map((v) => Math.round(v * 1000) / 1000).join());
      const used = m.map((x: any) => x.pos.join()); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(new Set(used).size).toBe(20);
      for (const u of used) expect(points).toContain(u);
      expect(m.every((x: any) => x.kind === "random" && x.ttl_s === null)).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  });
  it("picks at pickup_radius (<= 1.0 m) with height difference <= 1.5 m", () => {
    expect(events(sim({ motes: [[0, 0, 1]] }, [], { ticks: 2 }), "mote_picked")).toHaveLength(1);
    expect(events(sim({ motes: [[0, 0, 1.01]] }, [], { ticks: 2 }), "mote_picked")).toEqual([]);
    // Night 3 tier 1: Mây at Y 3. A mote 1 m above ground-level is 2 m lower: out of reach; 2 m up is 1 m lower: ok.
    const p = { pos: [18, 3, 10] as [number, number, number] };
    expect(events(sim({ player: p, motes: [[18, 1.4, 10.5]] }, [], { night: 3, ticks: 2 }), "mote_picked")).toEqual([]);
    expect(events(sim({ player: p, motes: [[18, 1.6, 10.5]] }, [], { night: 3, ticks: 2 }), "mote_picked")).toHaveLength(1);
  });
  it("carries at most 10 and leaves the rest", () => {
    const lines = sim({ player: { carried: 10 }, motes: [[0, 0, 0]] }, [], { ticks: 10 });
    expect(events(lines, "mote_picked")).toEqual([]);
    expect(lastSnap(lines).motes_active).toBe(1);
    const nine = sim({ player: { carried: 9 }, motes: [[0, 0, 0], [0, 0, 0.5]] }, [], { ticks: 3 });
    expect(events(nine, "mote_picked")).toHaveLength(1);
    expect(lastSnap(nine).player.carried).toBe(10);
  });
  it("picking gives no points; points come from depositing", () => {
    const lines = sim({ motes: [[0, 0, 0]] }, [], { ticks: 3 });
    expect(lastSnap(lines).score).toBe(0);
  });
  it("spawns one mote every 240 ticks on a free point, never above 30 or beyond the free points", () => {
    const n1 = sim({ random_motes: true }, [], { night: 1, ticks: 3000, every: 1 });
    expect(snapAt(n1, 239).motes_active).toBe(20);
    expect(snapAt(n1, 240).motes_active).toBe(21);
    expect(snapAt(n1, 960).motes_active).toBe(24);
    expect(snapAt(n1, 3000).motes_active).toBe(24); // Night 1 has only 24 points: later turns are skipped
    const n3 = sim({ random_motes: true }, [], { night: 3, ticks: 3000, every: 1 });
    expect(snapAt(n3, 2400).motes_active).toBe(30);
    expect(Math.max(...snaps(n3).map((s) => s.motes_active))).toBe(30);
    const ids = snapAt(n3, 3000).motes.map((m: any) => m.pos.join()); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(new Set(ids).size).toBe(30); // one mote per point
  });
  it("random_motes:false never spawns", () => {
    expect(snapAt(sim({}, [], { ticks: 500, every: 250 }), 500).motes_active).toBe(0);
  });
});

describe("Lanterns", () => {
  const L1 = { id: "L1", pos: [0, 0, 2] as [number, number, number] };
  it("cost is 10; deposits accumulate and the lantern remembers progress", () => {
    const frames = [...press("interact", 0), ...press("interact", 10)];
    const lines = sim({ player: { carried: 4 }, lanterns: [L1] }, frames, { ticks: 30 });
    expect(events(lines, "deposit").map((e) => e.data)).toEqual([
      { lantern_id: "L1", amount: 4, deposited: 4 },
    ]); // second press: nothing left to carry
    const two = sim({ player: { carried: 6 }, lanterns: [{ ...L1, deposited: 6 }] }, press("interact"), { ticks: 3 });
    expect(events(two, "deposit")[0]!.data).toEqual({ lantern_id: "L1", amount: 4, deposited: 10 });
    expect(events(two, "lantern_lit")).toEqual([{ type: "event", tick: 1, name: "lantern_lit", data: { lantern_id: "L1", relight: false } }]);
    expect(lastSnap(two).player.carried).toBe(2); // min(carried, missing)
  });
  it("scores +10 per deposited mote and +100 per lantern", () => {
    const lines = sim({ player: { carried: 10 }, lanterns: [L1] }, press("interact"), { ticks: 3 });
    expect(lastSnap(lines).score).toBe(10 * T.score.per_mote + T.score.per_lantern);
  });
  it("interaction radius 2.0 m (<=), lit lanterns are ignored", () => {
    const at = (d: number) => sim({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, d] }] }, press("interact"), { ticks: 3 });
    expect(events(at(2.0), "deposit")).toHaveLength(1);
    expect(events(at(2.01), "deposit")).toEqual([]);
    const lit = sim({ player: { carried: 5 }, lanterns: [{ ...L1, lit: true }] }, press("interact"), { ticks: 3 });
    expect(events(lit, "deposit")).toEqual([]);
  });
  it("chooses the nearest unlit lantern; equal distance -> smaller id", () => {
    const near = sim({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1.8] }, { id: "L2", pos: [0, 0, 1.0] }] }, press("interact"), { ticks: 3 });
    expect(events(near, "deposit")[0]!.data).toMatchObject({ lantern_id: "L2" });
    const tie = sim({ player: { carried: 3 }, lanterns: [{ id: "L2", pos: [1, 0, 0] }, { id: "L1", pos: [-1, 0, 0] }] }, press("interact"), { ticks: 3 });
    expect(events(tie, "deposit")[0]!.data).toMatchObject({ lantern_id: "L1" });
  });
  it("one press feeds one lantern; holding the key does not repeat", () => {
    const lines = sim({ player: { carried: 9 }, lanterns: [L1] }, [{ tick: 0, interact: true }], { ticks: 30 });
    expect(events(lines, "deposit")).toHaveLength(1);
  });
});

describe("Safe zones (6 m)", () => {
  const lit = (x: number, z: number) => ({ id: "L1", pos: [x, 0, z] as [number, number, number], lit: true });
  it("shades outside are stopped at the 6 m edge", () => {
    const lines = sim({ player: { pos: [0, 0, 20], flames: 9 }, lanterns: [lit(0, 20)], shades: [{ id: "S1", pos: [0, 1, 5], state: "chase" }] }, [], { ticks: 600 });
    const ds = snaps(lines).map((s) => dxz(s.shades[0].pos, [0, 0, 20]));
    expect(Math.min(...ds)).toBeGreaterThanOrEqual(6 - 1e-3);
    expect(Math.min(...ds)).toBeLessThan(6.01); // and it does come right up to the edge
    expect(events(lines, "player_hit")).toEqual([]);
  });
  it("a shade inside when the lantern is lit is pushed out within 30 ticks and cannot hurt meanwhile", () => {
    const lines = sim(
      { player: { pos: [0, 0, 19], carried: 1 }, lanterns: [{ id: "L1", pos: [0, 0, 20], deposited: 9 }], shades: [{ id: "S1", pos: [0, 1, 20.5], state: "chase" }] },
      press("interact"),
      { ticks: 120 },
    );
    expect(events(lines, "lantern_lit")).toHaveLength(1);
    const d = (t: number) => dxz(snapAt(lines, t).shades[0].pos, [0, 0, 20]);
    expect(d(1)).toBeGreaterThan(0.5); // already moving out
    expect(d(5)).toBeGreaterThan(d(1));
    expect(d(31)).toBeGreaterThanOrEqual(6 - 1e-3); // at the edge by tick 30 (+1 rounding)
    expect(events(lines, "player_hit")).toEqual([]);
  });
  it("shades never spawn inside a lit lantern's zone", () => {
    const m = getNight(1);
    const everyPointLit = m.lanterns.map((l, i) => ({ id: l.id, pos: m.shadePoints[i]!.map((v) => Math.round(v * 1000) / 1000) as [number, number, number], lit: true }));
    const lines = sim({ random_shades: true, lanterns: everyPointLit.slice(0, 5) }, [], { ticks: 400 });
    for (const e of events(lines, "shade_spawned")) {
      const s = snapAt(lines, e.tick).shades.find((x: any) => x.id === e.data.id); // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const l of everyPointLit) expect(dxz(s.pos, l.pos)).toBeGreaterThan(6);
    }
  });
});

// The old "Scoring and ending" block (win the moment every lantern is lit, +1 per second left) was removed
// by TICKET-03 (wins happen at dawn, not early; time bonus removed). Its replacements live in tests/fuel.test.ts.
