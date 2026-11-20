// T3: player movement (TICKET-02 Part 1: run, jump, dash, pads, walls, ramps, falling).
import { describe, expect, it } from "vitest";
import { dxz, endLine, events, lastSnap, near, press, sim, snapAt, snaps, T } from "./helpers.js";

describe("Run: 6 m/s with a 0.1 s (6 tick) ramp", () => {
  it("accelerates to exactly player_speed in 6 ticks and covers 5.75 m in 60 ticks", () => {
    const lines = sim({}, [{ tick: 0, move: [0, 1] }]);
    expect(snapAt(lines, 3).player.vel[2]).toBeCloseTo(3, 3);
    expect(snapAt(lines, 6).player.vel[2]).toBeCloseTo(T.player_speed, 3);
    expect(snapAt(lines, 60).player.vel[2]).toBeCloseTo(T.player_speed, 3);
    // (1+2+3+4+5+6 + 54×6) / 60
    expect(snapAt(lines, 60).player.pos[2]).toBeCloseTo(5.75, 2);
  });
  it("stops within 0.1 s after releasing", () => {
    const lines = sim({}, [{ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }]);
    expect(snapAt(lines, 30).player.vel[2]).toBeCloseTo(6, 3);
    expect(snapAt(lines, 36).player.vel[2]).toBeCloseTo(0, 3);
  });
  it("yaw 90° turns [0,1] into +X; diagonal is normalised", () => {
    const a = sim({}, [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }]);
    expect(snapAt(a, 60).player.pos[0]).toBeCloseTo(5.75, 2);
    const b = sim({}, [{ tick: 0, move: [1, 1] }]);
    expect(snapAt(b, 60).player.pos[0]).toBeCloseTo(5.75 / Math.SQRT2, 2);
  });
  it("full air control: steering in the air changes velocity", () => {
    const lines = sim({}, [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 3, move: [1, 0] }], { ticks: 30 });
    expect(snapAt(lines, 10).grounded ?? snapAt(lines, 10).player.grounded).toBe(false);
    expect(snapAt(lines, 10).player.vel[0]).toBeCloseTo(6, 3);
  });
});

describe("Jump: 7 m/s, gravity 20, only from the ground", () => {
  it("peaks near v²/2g = 1.225 m and lands after ~0.7 s", () => {
    const lines = sim({}, press("jump"), { ticks: 60 });
    const ys = snaps(lines).map((s) => s.player.pos[1]);
    expect(Math.max(...ys)).toBeGreaterThan(1.15);
    expect(Math.max(...ys)).toBeLessThan(1.23);
    expect(snapAt(lines, 6).player.vel[1]).toBeCloseTo(7 - (20 / 60) * 6, 3);
    expect(snapAt(lines, 44).player.grounded).toBe(true);
    expect(lastSnap(lines).player.pos[1]).toBe(0);
  });
  it("no double jump: pressing again in the air does nothing", () => {
    const single = sim({}, press("jump"), { ticks: 40 });
    const double = sim({}, [...press("jump"), ...press("jump", 10)], { ticks: 40 });
    expect(snaps(double).map((s) => s.player.pos[1])).toEqual(snaps(single).map((s) => s.player.pos[1]));
  });
});

describe("Dash: 14 m/s for 0.2 s, cooldown 1.5 s from the start", () => {
  it("moves 2.8 m along the facing direction (default +Z) and emits dash", () => {
    const lines = sim({}, press("dash"), { ticks: 20 });
    expect(events(lines, "dash")).toEqual([{ type: "event", tick: 1, name: "dash", data: {} }]);
    expect(snapAt(lines, 12).player.pos[2]).toBeCloseTo(T.dash_speed * T.dash_duration_s, 2);
    expect(snapAt(lines, 20).player.pos[2]).toBeCloseTo(2.8, 2); // stopped again, no drift
  });
  it("dashes in the movement direction when moving", () => {
    const lines = sim({}, [{ tick: 0, move: [1, 0], dash: true }, { tick: 1, dash: false }], { ticks: 12 });
    expect(snapAt(lines, 12).player.pos[0]).toBeGreaterThan(2.7);
    expect(Math.abs(snapAt(lines, 12).player.pos[2])).toBeLessThan(1e-6);
  });
  it("cooldown 90 ticks counted from the dash start", () => {
    const lines = sim({}, [...press("dash", 0), ...press("dash", 20), ...press("dash", 90)], { ticks: 100 });
    expect(events(lines, "dash").map((e) => e.tick)).toEqual([1, 91]);
    expect(snapAt(lines, 2).player.dash_cd_s).toBeCloseTo(89 / 60, 3);
  });
  it("is not invulnerable and keeps height in the air", () => {
    const lines = sim({}, [...press("jump", 0), ...press("dash", 8)], { ticks: 30 });
    // Frame tick 8 -> the dash runs during ticks 9..20 (12 ticks) with no gravity; gravity resumes at tick 21.
    const y8 = snapAt(lines, 8).player.pos[1];
    for (let t = 9; t <= 20; t++) expect(snapAt(lines, t).player.pos[1]).toBeCloseTo(y8, 6);
    expect(snapAt(lines, 21).player.pos[1]).toBeGreaterThan(y8);
    expect(snapAt(lines, 15).player.invuln).toBe(false);
  });
});

describe("Launch pads", () => {
  it("Night 2 pad (20,0,18) flies to island B: peak 4.9 m, 24 m/s toward B's centre, lands in the island", () => {
    const lines = sim({ player: { pos: [20, 0, 18] } }, [], { night: 2, ticks: 100 });
    expect(snapAt(lines, 1).player.vel[1]).toBeCloseTo(14, 1);
    expect(Math.hypot(snapAt(lines, 5).player.vel[0], snapAt(lines, 5).player.vel[2])).toBeCloseTo(24, 2);
    const ys = snaps(lines).map((s) => s.player.pos[1]);
    expect(Math.max(...ys)).toBeGreaterThan(4.7);
    expect(Math.max(...ys)).toBeLessThan(4.95);
    const end = lastSnap(lines).player;
    expect(end.grounded).toBe(true);
    expect(dxz(end.pos, [70, 0, 0])).toBeLessThan(28);
  });
  it("Night 2 pad on island B sends Mây back to island A", () => {
    const lines = sim({ player: { pos: [50, 0, -18] } }, [], { night: 2, ticks: 100 });
    expect(dxz(lastSnap(lines).player.pos, [0, 0, 0])).toBeLessThan(28);
  });
  it("move keys do not override the launch velocity", () => {
    const calm = sim({ player: { pos: [20, 0, 18] } }, [], { night: 2, ticks: 50 });
    // Keys pressed after take-off (tick 5); before that the pad has not triggered yet.
    const keys = sim({ player: { pos: [20, 0, 18] } }, [{ tick: 5, move: [-1, -1] }], { night: 2, ticks: 50 });
    expect(snapAt(keys, 50).player.pos).toEqual(snapAt(calm, 50).player.pos);
  });
  it("can still dash while launched", () => {
    const calm = sim({ player: { pos: [20, 0, 18] } }, [], { night: 2, ticks: 30 });
    const dash = sim({ player: { pos: [20, 0, 18] } }, press("dash", 10), { night: 2, ticks: 30 });
    expect(events(dash, "dash")).toHaveLength(1);
    expect(dxz(snapAt(dash, 30).player.pos, snapAt(calm, 30).player.pos)).toBeGreaterThan(1);
  });
  it("Night 3 pad (0,3,13): Y 12, 8 m/s toward −Z, lands on tier 2 (Y 6)", () => {
    const lines = sim({ player: { pos: [0, 3, 13] } }, [], { night: 3, ticks: 100 });
    expect(snapAt(lines, 1).player.vel[1]).toBeCloseTo(12, 1);
    expect(snapAt(lines, 5).player.vel[2]).toBeCloseTo(-8, 3);
    const end = lastSnap(lines).player;
    expect(end.pos[1]).toBe(6);
    expect(Math.hypot(end.pos[0], end.pos[2])).toBeLessThan(8);
    expect(Math.hypot(end.pos[0], end.pos[2])).toBeGreaterThan(2); // not into the tower
  });
});

describe("Night 3 terrain: walls, ramps, ledges", () => {
  it("cannot walk up a tier wall", () => {
    const lines = sim({ player: { pos: [0, 0, 27] } }, [{ tick: 0, move: [0, -1] }], { night: 3, ticks: 120 });
    const z = snaps(lines).map((s) => s.player.pos[2]);
    expect(Math.min(...z)).toBeGreaterThanOrEqual(24 - 1e-6);
    expect(lastSnap(lines).player.pos[1]).toBe(0);
  });
  it("cannot walk into the bell tower", () => {
    const lines = sim({ player: { pos: [0, 6, 6] } }, [{ tick: 0, move: [0, -1] }], { night: 3, ticks: 90 });
    expect(Math.min(...snaps(lines).map((s) => Math.hypot(s.player.pos[0], s.player.pos[2])))).toBeGreaterThanOrEqual(2 - 1e-6);
  });
  it("walks up a ramp onto tier 1", () => {
    const base = [30 * Math.cos(Math.PI / 6), 0, 30 * Math.sin(Math.PI / 6)];
    const lines = sim({ player: { pos: base as never } }, [{ tick: 0, move: [-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)] }], { night: 3, ticks: 120 });
    const mid = snapAt(lines, 60).player;
    expect(mid.pos[1]).toBeGreaterThan(2.5); // climbing
    const end = lastSnap(lines).player;
    expect(end.pos[1]).toBeCloseTo(3, 6);
    expect(Math.hypot(end.pos[0], end.pos[2])).toBeLessThan(24);
    expect(events(lines, "player_hit")).toEqual([]);
  });
  it("stepping off a ledge drops one tier (no fall event)", () => {
    const lines = sim({ player: { pos: [18, 3, 10] } }, [{ tick: 0, move: [-0.87, -0.5] }], { night: 3, ticks: 5 });
    // walk outward (+r): (18,10)/20.6; move vector is not outward, so use explicit outward direction instead
    const out = sim({ player: { pos: [18, 3, 10] } }, [{ tick: 0, move: [0.87, 0.49] }], { night: 3, ticks: 120 });
    expect(lastSnap(out).player.pos[1]).toBe(0);
    expect(lastSnap(out).player.grounded).toBe(true);
    expect(events(out, "player_hit")).toEqual([]);
    expect(snaps(lines).length).toBeGreaterThan(0);
  });
});

describe("Falling off the island (Y < −10)", () => {
  const edge = { player: { pos: [39.5, 0, 0] as [number, number, number], carried: 4 } };
  const walkOut = [{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }];

  it("loses a flame and all carried motes, then respawns at the start after 60 ticks with 90 invulnerable ticks", () => {
    const lines = sim(edge, walkOut, { ticks: 300 });
    const fall = events(lines, "player_hit");
    expect(fall).toHaveLength(1); // exactly once
    expect(fall[0]!.data).toEqual({ by: "fall", flames: T.flames - 1, dropped: 0, lost: 4 });
    const F = fall[0]!.tick;
    expect(snapAt(lines, F - 1).player.pos[1]).toBeGreaterThanOrEqual(-10);
    expect(snapAt(lines, F).player.pos[1]).toBeLessThan(-10);
    expect(snapAt(lines, F + 59).player.pos[1]).toBeLessThan(-10); // still waiting
    const back = snapAt(lines, F + 60).player;
    expect(back.pos).toEqual([0, 0, 0]);
    expect(back.vel).toEqual([0, 0, 0]);
    expect(back.invuln).toBe(true);
    expect(back.carried).toBe(0);
    expect(snapAt(lines, F + 60 + 90).player.invuln).toBe(false);
    expect(snapAt(lines, F + 60 + 89).player.invuln).toBe(true);
  });
  it("ignores invulnerability", () => {
    const lines = sim({ player: { ...edge.player, invuln_ticks: 1000 } }, walkOut, { ticks: 150 });
    expect(events(lines, "player_hit")).toHaveLength(1);
  });
  it("losing the last flame by falling ends the game immediately (no respawn)", () => {
    const lines = sim({ player: { ...edge.player, flames: 1 } }, walkOut, { ticks: 400 });
    const F = events(lines, "player_hit")[0]!.tick;
    expect(events(lines, "game_over")).toEqual([{ type: "event", tick: F, name: "game_over", data: { result: "lost", reason: "no_flames" } }]);
    expect(endLine(lines)).toMatchObject({ ticks: F, state: "lost" });
  });
  it("walking off the Night 2 bridge falls too (no railing)", () => {
    const lines = sim({ player: { pos: [35, 0, 1.9] } }, [{ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }], { night: 2, ticks: 150 });
    expect(events(lines, "player_hit")[0]!.data).toMatchObject({ by: "fall" });
  });
});

describe("Wind (Night 3)", () => {
  it("blows 5 s every 30 s at 2 m/s in one direction", () => {
    const lines = sim({ wind_enabled: true }, [], { night: 3, ticks: 2200, every: 1 });
    expect(snapAt(lines, 1799).wind.active).toBe(false);
    expect(snapAt(lines, 1800).wind.active).toBe(true);
    expect(snapAt(lines, 2099).wind.active).toBe(true);
    expect(snapAt(lines, 2100).wind.active).toBe(false);
    const a = snapAt(lines, 1799).player.pos;
    const b = snapAt(lines, 2099).player.pos;
    expect(dxz(a, b)).toBeCloseTo(2 * (299 / 60), 1); // 299 ticks of pushing
    const dir = (snapAt(lines, 1900).wind.dir_deg * Math.PI) / 180;
    expect(near((b[0]! - a[0]!) / dxz(a, b), Math.cos(dir), 0.02)).toBe(true);
  });
  it("is off in Nights 1 and 2", () => {
    const lines = sim({}, [], { night: 2, ticks: 2000, every: 100 });
    expect(snaps(lines).every((s) => !s.wind.active)).toBe(true);
  });
});
