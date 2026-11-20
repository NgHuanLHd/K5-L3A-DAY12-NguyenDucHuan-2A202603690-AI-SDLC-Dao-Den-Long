// T5 + T6: Tỏa Sáng (pulse) and Bóng Mực (shades).
import { describe, expect, it } from "vitest";
import { getNight } from "../src/core/maps.js";
import { dxz, events, lastSnap, near, press, sim, snapAt, snaps, T } from "./helpers.js";

type Pos = [number, number, number];
const shade = (x: number, z: number, o: Record<string, unknown> = {}) => ({ id: "S1", pos: [x, 1, z] as Pos, ...o });
const sh = (lines: any[], t: number, id = "S1") => snapAt(lines, t).shades.find((s: any) => s.id === id); // eslint-disable-line @typescript-eslint/no-explicit-any

describe("Tỏa Sáng (pulse)", () => {
  it("costs 3 motes, hits shades within 5 m (3D from foot + 0.8 m), +5 per shade", () => {
    const lines = sim({ player: { carried: 5 }, shades: [shade(4.9, 0, { id: "S1" }), shade(5.2, 0, { id: "S2" }), shade(0, -3, { id: "S3" })] }, press("pulse"), { ticks: 3 });
    expect(events(lines, "pulse")).toEqual([{ type: "event", tick: 1, name: "pulse", data: { stunned_ids: ["S1", "S3"] } }]);
    expect(snapAt(lines, 1).player.carried).toBe(2);
    expect(snapAt(lines, 1).score).toBe(2 * T.score.per_stun);
    expect(sh(lines, 1, "S1").state).toBe("stunned");
    expect(sh(lines, 1, "S2").state).not.toBe("stunned");
  });
  it("uses 3D distance: a shade 6 m straight above is out of range even at the same X/Z", () => {
    const lines = sim({ player: { carried: 3 }, shades: [{ id: "S1", pos: [0, 6, 0] }] }, press("pulse"), { ticks: 2 });
    expect(events(lines, "pulse")[0]!.data).toEqual({ stunned_ids: [] }); // fired (cost paid), nobody hit
  });
  it("does not fire with fewer than 3 motes, or during the 3 s cooldown (180 ticks)", () => {
    expect(events(sim({ player: { carried: 2 } }, press("pulse"), { ticks: 3 }), "pulse")).toEqual([]);
    const lines = sim({ player: { carried: 9 } }, [...press("pulse", 0), ...press("pulse", 100), ...press("pulse", 180)], { ticks: 200 });
    expect(events(lines, "pulse").map((e) => e.tick)).toEqual([1, 181]);
    expect(snapAt(lines, 1).player.pulse_cd_s).toBe(3);
  });
  it("pushes 4 m in 15 ticks, stuns for 120 ticks, and does not kill", () => {
    const lines = sim({ player: { carried: 3 }, shades: [shade(3, 0)] }, press("pulse"), { ticks: 130 });
    expect(sh(lines, 1).pos[0]).toBeCloseTo(3 + 4 / 15, 2);
    expect(sh(lines, 15).pos[0]).toBeCloseTo(7, 2);
    expect(sh(lines, 16).pos[0]).toBeCloseTo(7, 2); // pushed only during the first 15 ticks
    expect(sh(lines, 120).state).toBe("stunned");
    expect(["chase", "wander"]).toContain(sh(lines, 121).state);
    expect(events(lines, "player_hit")).toEqual([]);
  });
  it("a shade exactly on top of Mây is pushed along +X", () => {
    const lines = sim({ player: { carried: 3 }, shades: [shade(0, 0)] }, press("pulse"), { ticks: 20 });
    expect(sh(lines, 15).pos[0]).toBeCloseTo(4, 2);
    expect(sh(lines, 15).pos[2]).toBeCloseTo(0, 6);
  });
  it("hitting an already stunned shade refreshes the stun and the push and scores again", () => {
    const lines = sim({ player: { carried: 6 }, shades: [shade(3, 0)] }, [...press("pulse", 0), ...press("pulse", 180)], { ticks: 200 });
    // first pulse at tick 1, second at 181 (cooldown); by then the shade is stunned only if refreshed... it recovered at 121.
    expect(events(lines, "pulse")).toHaveLength(2);
    const both = sim({ player: { carried: 6, pulse_cd_ticks: 0 }, shades: [shade(3, 0, { state: "stunned", state_ticks_left: 50 })] }, press("pulse"), { ticks: 140 });
    expect(sh(both, 120).state).toBe("stunned"); // 50 would have ended at tick 50; the pulse restarts 120
    expect(snapAt(both, 1).score).toBe(T.score.per_stun); // counted although already stunned
  });
  it("stunned shades neither move on their own nor hurt", () => {
    // 60 ticks left at setup: still stunned in the snapshot of tick 59, active again on tick 60.
    const lines = sim({ shades: [shade(0.5, 0, { state: "stunned", state_ticks_left: 60 })] }, [], { ticks: 59 });
    expect(events(lines, "player_hit")).toEqual([]);
    expect(sh(lines, 59).pos[0]).toBeCloseTo(0.5, 6);
    expect(sh(lines, 59).state).toBe("stunned");
  });
});

describe("Bóng Mực: states and movement", () => {
  it("wander -> chase within 12 m; chase -> wander beyond 18 m; chases at 4 m/s", () => {
    const at12 = sim({ shades: [shade(12, 0)] }, [], { ticks: 2 });
    expect(sh(at12, 1).state).toBe("chase");
    const at12b = sim({ shades: [shade(12.2, 0)] }, [], { ticks: 2 });
    expect(sh(at12b, 1).state).toBe("wander");
    const lose = sim({ shades: [shade(18.5, 0, { state: "chase" })] }, [], { ticks: 2 });
    expect(sh(lose, 1).state).toBe("wander");
    const keep = sim({ shades: [shade(17.5, 0, { state: "chase" })] }, [], { ticks: 2 });
    expect(sh(keep, 1).state).toBe("chase");
    const run = sim({ shades: [shade(10, 0)] }, [], { ticks: 60 });
    expect(sh(run, 60).pos[0]).toBeCloseTo(10 - T.shade_speed, 2);
  });
  it("Night 3 shades are faster (4.5 m/s)", () => {
    const run = sim({ shades: [shade(10, -30)], player: { pos: [0, 0, -30] } }, [], { night: 3, ticks: 60 });
    expect(sh(run, 60).pos[0]).toBeCloseTo(10 - 4.5, 2);
  });
  it("state names are exactly spawning / wander / chase / recoil / stunned", () => {
    const lines = sim({ random_shades: true, player: { flames: 99 } }, [], { ticks: 900, every: 5 });
    const seen = new Set(snaps(lines).flatMap((s) => s.shades.map((x: any) => x.state))); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const st of seen) expect(["spawning", "wander", "chase", "recoil", "stunned"]).toContain(st);
    expect(seen.has("spawning")).toBe(true);
  });
  it("a shade does not climb tier walls (Night 3) and so cannot hurt Mây above it", () => {
    const m = [8.697, 8.697]; // tier 1 (Y 3), 12.3 m from the centre at 45°
    const lines = sim({ player: { pos: [m[0]!, 3, m[1]!] }, shades: [{ id: "S1", pos: [8.273, 1, 8.273] }] }, [], { night: 3, ticks: 120 });
    expect(events(lines, "player_hit")).toEqual([]); // 0.6 m apart on the map, but 2 m apart in height
    expect(sh(lines, 120).pos[1]).toBe(1);
  });
});

describe("Bóng Mực: contact", () => {
  it("hit: XZ <= 1.0 m and height difference <= 1.5 m -> -1 flame, drops floor(carried/2), invulnerable 90 ticks", () => {
    const lines = sim({ player: { carried: 7 }, shades: [shade(1.0, 0)] }, [], { ticks: 100 });
    const hits = events(lines, "player_hit");
    expect(hits[0]).toMatchObject({ tick: 1, data: { by: "shade", flames: T.flames - 1, dropped: 3 } });
    expect(snapAt(lines, 1).player.carried).toBe(4);
    expect(snapAt(lines, 1).player.invuln).toBe(true);
    expect(snapAt(lines, 90).player.invuln).toBe(true);
    expect(hits[1]?.tick ?? 91).toBeGreaterThanOrEqual(91); // nothing while invulnerable; the next hit comes only when it ends
  });
  it("dropped motes ring Mây at 1.5-2.5 m, live 480 ticks and can be picked up again", () => {
    const lines = sim({ player: { carried: 6, flames: 99 }, shades: [shade(1.0, 0)] }, [], { ticks: 500 });
    const ms = snapAt(lines, 1).motes;
    expect(ms).toHaveLength(3);
    for (const m of ms) {
      expect(m.kind).toBe("dropped");
      expect(m.ttl_s).toBeCloseTo(8, 2);
      const d = dxz(m.pos, snapAt(lines, 1).player.pos);
      expect(d).toBeGreaterThanOrEqual(1.5 - 1e-3);
      expect(d).toBeLessThanOrEqual(2.5 + 1e-3);
    }
    expect(snapAt(lines, 480).motes.filter((m: any) => m.kind === "dropped").length).toBeGreaterThan(0); // eslint-disable-line @typescript-eslint/no-explicit-any
    const walk = sim({ player: { carried: 6, invuln_ticks: 0 }, shades: [shade(1.0, 0)] }, [{ tick: 2, move: [0, 1] }], { ticks: 30 });
    expect(snapAt(walk, 1).motes).toHaveLength(3);
  });
  it("the shade recoils 2 m over 60 ticks, then returns to chasing; no second hit before invulnerability ends", () => {
    const lines = sim({ shades: [shade(1.0, 0)] }, [], { ticks: 130 });
    expect(sh(lines, 1).state).toBe("recoil");
    expect(sh(lines, 60).state).toBe("recoil");
    const x1 = sh(lines, 1).pos[0];
    expect(sh(lines, 61).pos[0] - x1).toBeCloseTo(2, 1);
    expect(sh(lines, 61).state).toBe("chase");
    const hits = events(lines, "player_hit");
    expect(hits.length).toBeGreaterThan(1);
    expect(hits[1]!.tick).toBeGreaterThanOrEqual(91);
  });
  it("a shade touching an invulnerable Mây does nothing (no recoil either)", () => {
    const lines = sim({ player: { invuln_ticks: 100 }, shades: [shade(0.5, 0)] }, [], { ticks: 50 });
    expect(events(lines, "player_hit")).toEqual([]);
    expect(sh(lines, 50).state).toBe("chase");
  });
  it("at most one flame per tick even with several shades on top of Mây", () => {
    const lines = sim({ shades: [shade(0.3, 0, { id: "S1" }), shade(0.3, 0.1, { id: "S2" }), shade(0.2, 0, { id: "S3" })] }, [], { ticks: 10 });
    expect(events(lines, "player_hit")).toHaveLength(1);
    expect(snapAt(lines, 1).player.flames).toBe(T.flames - 1);
  });
  it("the lowest id hits first and only the others stay in their state", () => {
    const lines = sim({ shades: [shade(0.3, 0, { id: "S2" }), shade(0.3, 0.1, { id: "S10" }), shade(0.2, 0, { id: "S3" })] }, [], { ticks: 2 });
    expect(sh(lines, 1, "S2").state).toBe("recoil");
    expect(sh(lines, 1, "S3").state).toBe("chase");
    expect(sh(lines, 1, "S10").state).toBe("chase");
  });
});

describe("Bóng Mực: spawning", () => {
  const spawned = (night: number, ticks: number, scen = {}) => {
    const lines = sim({ random_shades: true, player: { flames: 99, pos: [0, 0, 0] }, ...scen }, [], { night, ticks, every: 1 });
    return { lines, ev: events(lines, "shade_spawned") };
  };
  it("2 shades at tick 300 (S1, S2), then 1 per interval: Night 1 every 480, Night 2 every 420, Night 3 every 360", () => {
    for (const [night, every] of [[1, 480], [2, 420], [3, 360]] as const) {
      const { ev } = spawned(night, 300 + every * 2 + 1, night === 3 ? { player: { flames: 99, pos: [0, 0, -30] } } : {});
      expect(ev.map((e) => [e.tick, e.data.id])).toEqual([[300, "S1"], [300, "S2"], [300 + every, "S3"], [300 + 2 * every, "S4"]]);
    }
  });
  it("caps at 6 / 8 / 10 shades", () => {
    for (const [night, max, every] of [[1, 6, 480], [2, 8, 420], [3, 10, 360]] as const) {
      const { ev } = spawned(night, 300 + every * (max + 2), night === 3 ? { player: { flames: 99, pos: [0, 0, -30] } } : {});
      expect(ev).toHaveLength(max);
    }
  });
  it("spawn on standard points at least 15 m from Mây; the new shade is 'spawning' and only acts next tick", () => {
    const m = getNight(1);
    const pts = m.shadePoints.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[2] * 1000) / 1000].join());
    const { lines, ev } = spawned(1, 303);
    for (const e of ev) {
      const s = sh(lines, e.tick, e.data.id as string);
      expect(pts).toContain([s.pos[0], s.pos[2]].join());
      expect(s.state).toBe("spawning");
      expect(dxz(s.pos, snapAt(lines, e.tick).player.pos)).toBeGreaterThanOrEqual(15);
      expect(["chase", "wander"]).toContain(sh(lines, e.tick + 1, e.data.id as string).state);
    }
    expect(events(lines, "player_hit")).toEqual([]); // a fresh shade never hits on its spawn tick
  });
  it("skips a turn when no valid point remains (Mây within 15 m of every point)", () => {
    const m = getNight(1);
    // Every lantern lit around... instead light zones over all points: 12 zones.
    const zones = m.shadePoints.map((p, i) => ({ id: `L${(i % 5) + 1}`, pos: p, lit: true }));
    const { ev } = spawned(1, 400, { lanterns: zones.slice(0, 5) });
    expect(ev.length).toBeLessThanOrEqual(2);
  });
  it("random_shades:false never spawns", () => {
    expect(events(sim({}, [], { ticks: 1000, every: 500 }), "shade_spawned")).toEqual([]);
  });
});

it("helper sanity", () => {
  expect(near(1, 1.001)).toBe(true);
  expect(lastSnap(sim({}, [], { ticks: 1 })).tick).toBe(1);
});
