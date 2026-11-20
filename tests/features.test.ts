// T7 + T8: Gió Lạc (drifters), Bùa Gió (charm), pause.
import { describe, expect, it } from "vitest";
import { dxz, events, lastSnap, near, press, sim, snapAt, snaps, T } from "./helpers.js";

type Pos = [number, number, number];
const dr = (lines: any[], t: number, id: string) => snapAt(lines, t).drifters.find((d: any) => d.id === id); // eslint-disable-line @typescript-eslint/no-explicit-any
const drifter = (x: number, z: number, o: Record<string, unknown> = {}) => ({ id: "D1", pos: [x, 1.5, z] as Pos, ...o });

describe("Gió Lạc: spawning", () => {
  it("Nights 2 and 3: D1 at tick 1200, D2 at 2400, never more than 2 alive; Night 1: none", () => {
    const n2 = sim({ random_drifters: true }, [], { night: 2, ticks: 3700, every: 1 });
    expect(snapAt(n2, 1199).drifters).toHaveLength(0);
    expect(snapAt(n2, 1200).drifters.map((d: any) => [d.id, d.state])).toEqual([["D1", "idle"]]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(snapAt(n2, 2400).drifters.map((d: any) => d.id)).toEqual(["D1", "D2"]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(snapAt(n2, 3600).drifters).toHaveLength(2); // both alive: this turn is skipped
    const n3 = sim({ random_drifters: true }, [], { night: 3, ticks: 1201, every: 1 });
    expect(snapAt(n3, 1200).drifters).toHaveLength(1);
    const n1 = sim({}, [], { night: 1, ticks: 1300, every: 100 });
    expect(snaps(n1).every((s) => s.drifters.length === 0)).toBe(true);
  });
  it("a removed drifter frees a slot for the next scheduled one", () => {
    const lines = sim({ random_drifters: true, drifters: [drifter(0, 0, { id: "D1", state: "flee", state_ticks_left: 5 }), drifter(9, 9, { id: "D2" })] }, [], { night: 2, ticks: 1300, every: 100 });
    expect(snapAt(lines, 1200).drifters.map((d: any) => d.state)).toEqual(["removed", "idle", "idle"]); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  it("idle drifters drift slowly (2 m/s) and never leave unless they flee", () => {
    const lines = sim({ drifters: [drifter(20, 0)] }, [], { night: 2, ticks: 120, every: 1 });
    expect(dxz(dr(lines, 60, "D1").pos, dr(lines, 0, "D1").pos)).toBeLessThanOrEqual(2.001);
    expect(dr(lines, 120, "D1").state).toBe("idle");
  });
});

describe("Gió Lạc: chase and steal", () => {
  it("chases when Mây carries >= 5 motes and is within 15 m; otherwise idle", () => {
    const at = (carried: number, x: number) => dr(sim({ player: { carried }, drifters: [drifter(x, 0)] }, [], { night: 2, ticks: 2 }), 1, "D1").state;
    expect(at(5, 15)).toBe("chase");
    expect(at(4, 10)).toBe("idle");
    expect(at(5, 15.5)).toBe("idle");
  });
  it("loses interest (back to idle) when the condition stops holding", () => {
    const lines = sim({ player: { carried: 5 }, drifters: [drifter(14, 0)] }, press("interact"), { night: 2, ticks: 3 });
    expect(dr(lines, 1, "D1").state).toBe("chase");
    const dropped = sim({ player: { carried: 5, flames: 99 }, drifters: [drifter(14, 0)], lanterns: [{ id: "L1", pos: [0, 0, 1] }] }, [{ tick: 1, interact: true }], { night: 2, ticks: 4 });
    expect(dr(dropped, 4, "D1").state).toBe("idle"); // deposited 5 -> carried 0
  });
  it("steals min(3, carried) on contact (XZ <= 1.2), flees 240 ticks, then vanishes with the loot; steals once", () => {
    const lines = sim({ player: { carried: 6, invuln_ticks: 1000 }, drifters: [drifter(5, 0, { state: "chase" })] }, [], { night: 2, ticks: 300, every: 1 });
    const steal = events(lines, "drifter_steal");
    expect(steal).toHaveLength(1);
    expect(steal[0]!.data).toEqual({ drifter_id: "D1", amount: 3, carried: 3 });
    const S = steal[0]!.tick;
    expect(S).toBeGreaterThan(25); // flies 7 m/s: (5 - 1.2) / (7/60) = 32.6 ticks
    expect(S).toBeLessThan(40);
    expect(dr(lines, S, "D1")).toMatchObject({ state: "flee", stolen: 3 });
    expect(snapAt(lines, S).player.carried).toBe(3);
    expect(dr(lines, S + 239, "D1").state).toBe("flee");
    expect(dr(lines, S + 240, "D1")).toMatchObject({ state: "removed", stolen: 0 });
    // Invulnerability does not protect, and no flame is lost.
    expect(snapAt(lines, S).player.flames).toBe(T.flames);
    expect(events(lines, "player_hit")).toEqual([]);
  });
  it("flees at 7 m/s away from Mây", () => {
    const lines = sim({ player: { carried: 6 }, drifters: [drifter(1, 0, { state: "chase" })] }, [], { night: 2, ticks: 60 });
    const S = events(lines, "drifter_steal")[0]!.tick;
    expect(dxz(dr(lines, 60, "D1").pos, snapAt(lines, 60).player.pos)).toBeGreaterThan(dxz(dr(lines, S, "D1").pos, snapAt(lines, S).player.pos) + 3);
  });
  it("lit lantern safe zones do not stop drifters", () => {
    const lines = sim({ player: { carried: 6, pos: [0, 0, 20] }, lanterns: [{ id: "L1", pos: [0, 0, 20], lit: true }], drifters: [drifter(0, 30, { state: "chase" })] }, [], { night: 2, ticks: 100 });
    expect(events(lines, "drifter_steal")).toHaveLength(1);
  });
});

describe("Gió Lạc: Tỏa Sáng", () => {
  it("hitting a chasing drifter makes it flee without stealing", () => {
    const lines = sim({ player: { carried: 6 }, drifters: [drifter(4, 0, { state: "chase" })] }, press("pulse"), { night: 2, ticks: 60 });
    expect(dr(lines, 1, "D1")).toMatchObject({ state: "flee", stolen: 0 });
    expect(events(lines, "drifter_steal")).toEqual([]);
  });
  it("hitting a fleeing drifter that carries loot makes it drop everything on the spot; it disappears 120 ticks later", () => {
    const lines = sim({ player: { carried: 3 }, drifters: [drifter(3, 0, { state: "flee", stolen: 3, state_ticks_left: 200 })] }, press("pulse"), { night: 2, ticks: 130, every: 1 });
    expect(events(lines, "drifter_drop")).toEqual([{ type: "event", tick: 1, name: "drifter_drop", data: { drifter_id: "D1", amount: 3 } }]);
    const dropped = snapAt(lines, 1).motes.filter((m: any) => m.kind === "dropped"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(dropped).toHaveLength(3);
    expect(dxz(dropped[0].pos, dr(lines, 1, "D1").pos)).toBeLessThan(0.2); // at the drifter's place
    expect(dr(lines, 1, "D1").stolen).toBe(0);
    expect(dr(lines, 119, "D1").state).toBe("flee");
    expect(dr(lines, 120, "D1").state).toBe("removed");
  });
  it("hitting an idle drifter or an empty fleeing one does nothing to it", () => {
    const lines = sim({ player: { carried: 6 }, drifters: [drifter(3, 0, { id: "D1" }), drifter(0, 3, { id: "D2", state: "flee" })] }, press("pulse"), { night: 2, ticks: 3 });
    expect(dr(lines, 1, "D1").state).toBe("idle");
    expect(events(lines, "drifter_drop")).toEqual([]);
  });
});

describe("Bùa Gió (charm)", () => {
  const charmAt = (n: number) => ({ night: n, ticks: 3 });
  it("positions: Night 2 (35,0,0); Night 3 (30,0,25) and (-30,0,25); none in Night 1", () => {
    expect(snapAt(sim({}, [], { night: 1, ticks: 0 }), 0).charms).toEqual([]);
    expect(snapAt(sim({}, [], { night: 2, ticks: 0 }), 0).charms.map((c: any) => c.id)).toEqual(["C1"]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(snapAt(sim({}, [], { night: 3, ticks: 0 }), 0).charms.map((c: any) => c.id)).toEqual(["C1", "C2"]); // eslint-disable-line @typescript-eslint/no-explicit-any
    const pick = sim({ player: { pos: [30, 0, 25] } }, [], charmAt(3));
    expect(events(pick, "charm_picked")[0]!.data).toEqual({ charm_id: "C1", charm_ticks: 600 });
  });
  it("lasts 600 ticks, makes Mây run at 7.2 m/s; the charm reappears 2700 ticks after pick-up", () => {
    const run = sim({ player: { pos: [35, 0, 0] } }, [{ tick: 0, move: [1, 0] }], { night: 2, ticks: 12, every: 1 });
    expect(near(snapAt(run, 8).player.vel[0], 7.2, 1e-3)).toBe(true);
    const lines = sim({ player: { pos: [35, 0, 0] } }, [], { night: 2, ticks: 2705, every: 1 });
    const pick = events(lines, "charm_picked");
    expect(pick[0]!.tick).toBe(1);
    expect(pick[1]!.tick).toBe(2701); // standing next to it, Mây takes it again the moment it is back
    expect(snapAt(lines, 1).player.charm_s).toBe(10);
    expect(snapAt(lines, 600).player.charm_s).toBeGreaterThan(0);
    expect(snapAt(lines, 601).player.charm_s).toBe(0);
    expect(snapAt(lines, 10).charms[0]).toMatchObject({ id: "C1", available: false });
    expect(snapAt(lines, 2700).charms[0].available).toBe(false);
    expect(snapAt(lines, 2701).charms[0].available).toBe(false); // re-picked at once
    expect(snapAt(lines, 2701).player.charm_s).toBe(10);
  });
  it("picking up a second charm refreshes the timer", () => {
    const lines = sim({ player: { pos: [35, 0, 0], charm_ticks: 100 }, charms: [{ id: "C1", pos: [35, 0, 0] }] }, [], { night: 2, ticks: 3 });
    expect(snapAt(lines, 1).player.charm_s).toBe(10);
  });
  it("makes dash free of cooldown, but each dash still needs a fresh press and a press during a dash is ignored", () => {
    const frames = [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }, { tick: 21, dash: false }];
    const charm = sim({ player: { charm_ticks: 600 } }, frames, { ticks: 40 });
    expect(events(charm, "dash").map((e) => e.tick)).toEqual([1, 21]);
    expect(snapAt(charm, 2).player.dash_cd_s).toBe(0);
    const plain = sim({}, frames, { ticks: 40 });
    expect(events(plain, "dash").map((e) => e.tick)).toEqual([1]);
  });
  it("a dash with a charm still moves 14 m/s for 12 ticks", () => {
    const lines = sim({ player: { charm_ticks: 600 } }, press("dash"), { ticks: 12 });
    expect(snapAt(lines, 12).player.pos[2]).toBeCloseTo(2.8, 2);
  });
  it("scenario charms replace the default list; unavailable charms cannot be picked", () => {
    const lines = sim({ player: { pos: [35, 0, 0] }, charms: [{ id: "C1", available: false, respawn_ticks: 100 }] }, [], { night: 2, ticks: 150, every: 1 });
    expect(events(lines, "charm_picked").map((e) => e.tick)).toEqual([100]);
    expect(snapAt(lines, 99).charms[0]).toMatchObject({ available: false });
    const none = sim({ player: { pos: [35, 0, 0] }, charms: [] }, [], { night: 2, ticks: 5 });
    expect(snapAt(none, 0).charms).toEqual([]);
  });
});

describe("Pause", () => {
  // frame tick k is read by step k and produces state k+1
  const frames = [{ tick: 0, move: [0, 1] }, { tick: 5, pause: true }, { tick: 6, pause: false }, { tick: 10, pause: true }, { tick: 11, pause: false }];
  const lines = sim({ player: { carried: 9 }, shades: [{ id: "S1", pos: [30, 1, 0] }] }, frames, { ticks: 30, every: 1 });

  it("emits paused / resumed; the wall tick keeps counting but sim_tick, time and positions freeze", () => {
    expect(events(lines).filter((e) => e.name === "paused" || e.name === "resumed").map((e) => [e.tick, e.name])).toEqual([[6, "paused"], [11, "resumed"]]);
    for (let t = 6; t <= 10; t++) {
      const s = snapAt(lines, t);
      expect(s.state).toBe("paused");
      expect(s.sim_tick).toBe(5);
      expect(s.time_left_s).toBe(snapAt(lines, 5).time_left_s);
      expect(s.player.pos).toEqual(snapAt(lines, 5).player.pos);
      expect(s.shades[0].pos).toEqual(snapAt(lines, 5).shades[0].pos);
    }
    expect(snapAt(lines, 11)).toMatchObject({ state: "playing", sim_tick: 6 });
    expect(snapAt(lines, 5)).toMatchObject({ state: "playing", sim_tick: 5 });
  });
  it("cooldowns and spawn timers are frozen too", () => {
    const l = sim({ random_shades: true, player: { pulse_cd_ticks: 100, invuln_ticks: 100, charm_ticks: 100 } }, [{ tick: 0, pause: true }], { ticks: 1000, every: 1 });
    expect(snapAt(l, 1000).player).toMatchObject({ pulse_cd_s: 1.667, charm_s: 1.667, invuln: true }); // 100 ticks, untouched
    expect(events(l, "shade_spawned")).toEqual([]); // sim_tick never reaches 300
    expect(snapAt(l, 1000).sim_tick).toBe(0);
  });
  it("the game can end only while running; paused steps do not end the game", () => {
    const l = sim({ time_left_s: 1 }, [{ tick: 0, pause: true }], { ticks: 500, every: 100 });
    expect(lastSnap(l).state).toBe("paused");
    expect(l.at(-1)).toMatchObject({ type: "end", ticks: 500, state: "paused" });
  });
});
