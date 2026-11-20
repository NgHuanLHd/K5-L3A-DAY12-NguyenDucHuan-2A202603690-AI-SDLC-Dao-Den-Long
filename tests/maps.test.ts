// T2: the three standard maps (TICKET-02 Part 2).
import { describe, expect, it } from "vitest";
import { getNight, N3 } from "../src/core/maps.js";

const pts = (xs: number[][]) => xs.map(([x, y, z]) => [Math.round(x! * 1000) / 1000, y, Math.round(z! * 1000) / 1000]);
const at = (r: number, deg: number, cx = 0, cz = 0) => [cx + r * Math.cos((deg * Math.PI) / 180), cz + r * Math.sin((deg * Math.PI) / 180)];

describe("Night 1: Đảo Bến", () => {
  const m = getNight(1);
  it("round island radius 40, sea outside", () => {
    expect(m.height(0, 0)).toBe(0);
    expect(m.height(40, 0)).toBe(0);
    expect(m.height(40.01, 0)).toBeNull();
  });
  it("start (0,0,0) facing +Z; lanterns L1..L5 at the standard positions", () => {
    expect(m.start).toEqual([0, 0, 0]);
    expect(m.facing).toEqual([0, 1]);
    expect(m.lanterns.map((l) => [l.id, ...l.pos])).toEqual([
      ["L1", 0, 0, 25], ["L2", 23.8, 0, 7.7], ["L3", 14.7, 0, -20.2], ["L4", -14.7, 0, -20.2], ["L5", -23.8, 0, 7.7],
    ]);
  });
  it("24 mote points (8 on r=12 every 45°, 16 on r=33 every 22.5°) and 12 shade points on r=37 from 15°", () => {
    expect(m.motePoints).toHaveLength(24);
    expect(m.motePoints.slice(0, 8).every((p) => Math.abs(Math.hypot(p[0], p[2]) - 12) < 1e-9)).toBe(true);
    expect(m.motePoints[1]![0]).toBeCloseTo(at(12, 45)[0]!, 9);
    expect(m.motePoints.slice(8).every((p) => Math.abs(Math.hypot(p[0], p[2]) - 33) < 1e-9)).toBe(true);
    expect(m.motePoints[9]![2]).toBeCloseTo(at(33, 22.5)[1]!, 9);
    expect(m.shadePoints).toHaveLength(12);
    expect(m.shadePoints[0]![0]).toBeCloseTo(at(37, 15)[0]!, 9);
    expect(m.shadePoints[1]![2]).toBeCloseTo(at(37, 45)[1]!, 9);
  });
  it("shade schedule: every 8 s (480 ticks), max 6", () => {
    expect([m.shadeEveryTicks, m.shadeMax]).toEqual([480, 6]);
  });
});

describe("Night 2: Đảo Cau", () => {
  const m = getNight(2);
  it("two islands r=28 at A(0,0,0) and B(70,0,0) joined by a bridge x∈[26,44], z∈[-2,2]", () => {
    expect(m.height(0, 0)).toBe(0);
    expect(m.height(70, 0)).toBe(0);
    expect(m.height(28, 0)).toBe(0);
    expect(m.height(35, 0)).toBe(0); // bridge
    expect(m.height(35, 2)).toBe(0);
    expect(m.height(35, 2.01)).toBeNull(); // no railing: sea beside the bridge
    expect(m.height(35, 10)).toBeNull();
    expect(m.height(70 + 28.01, 0)).toBeNull();
  });
  it("lanterns L1..L6 in the standard order", () => {
    expect(m.lanterns.map((l) => l.pos)).toEqual([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
  });
  it("24 mote points (4 on r=10, 8 on r=22 per island) and 16 shade points on r=26", () => {
    expect(m.motePoints).toHaveLength(24);
    expect(m.motePoints.slice(12).every((p) => p[0] > 40)).toBe(true);
    expect(m.shadePoints).toHaveLength(16);
    expect(m.shadePoints[0]![0]).toBeCloseTo(at(26, 22.5)[0]!, 9);
    expect(m.shadePoints[8]![0]).toBeCloseTo(at(26, 22.5, 70)[0]!, 9);
  });
  it("two launch pads send Mây to the other island: Y 14, horizontal 24", () => {
    expect(m.pads.map((p) => [p.pos, p.vy, p.hv])).toEqual([[[20, 0, 18], 14, 24], [[50, 0, -18], 14, 24]]);
    const [dx, dz] = m.pads[0]!.dir;
    expect(dx).toBeCloseTo(50 / Math.hypot(50, 18), 9);
    expect(dz).toBeCloseTo(-18 / Math.hypot(50, 18), 9);
    expect(m.pads[1]!.dir[0]).toBeLessThan(0);
  });
  it("charm C1 at (35,0,0); shades every 7 s, max 8", () => {
    expect(m.charms).toEqual([{ id: "C1", pos: [35, 0, 0] }]);
    expect([m.shadeEveryTicks, m.shadeMax, m.shadeSpeed]).toEqual([420, 8, null]);
    expect([m.drifters, m.wind]).toEqual([true, false]);
  });
});

describe("Night 3: Đảo Chuông", () => {
  const m = getNight(3);
  it("island r=45, tiers at Y 0 / 3 / 6, tower 14 at the centre", () => {
    expect(m.height(40, 0)).toBe(0);
    expect(m.height(45.01, 0)).toBeNull();
    expect(m.height(0, 18)).toBe(3); // ring 12..24, z > 0
    expect(m.height(0, -18)).toBe(0); // same radius on the z < 0 half is ground level
    expect(m.height(0, 11.9)).toBe(0);
    expect(m.height(0, 24.01)).toBe(0);
    expect(m.height(0, 5)).toBe(N3.TIER2_Y); // disc r=8
    expect(m.height(0, 8.01)).toBe(0);
    expect(m.height(0, 1.9)).toBe(N3.TOWER_TOP); // tower r=2, 8 m above tier 2
    expect(m.height(0, 2.1)).toBe(6);
  });
  it("ramps (3 m wide) at 30° and 150° climb from Y 0 at r=30 to Y 3 at r=24", () => {
    for (const deg of [30, 150]) {
      const [x30, z30] = at(30, deg);
      const [x27, z27] = at(27, deg);
      const [x24, z24] = at(24, deg);
      expect(m.height(x30!, z30!)).toBeCloseTo(0, 9);
      expect(m.height(x27!, z27!)).toBeCloseTo(1.5, 9);
      expect(m.height(x24!, z24!)).toBeCloseTo(3, 9);
    }
    // 1.5 m to either side of the centre line is still ramp; 1.6 m is not.
    const u = [Math.cos((30 * Math.PI) / 180), Math.sin((30 * Math.PI) / 180)];
    const side = (d: number) => m.height(27 * u[0]! - d * u[1]!, 27 * u[1]! + d * u[0]!);
    expect(side(1.4)).toBeCloseTo(1.5, 9);
    expect(side(1.6)).toBe(0);
  });
  it("lanterns L1..L7 including heights 6 and 3", () => {
    expect(m.lanterns.map((l) => l.pos)).toEqual([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
    for (const l of m.lanterns) expect(m.height(l.pos[0], l.pos[2])).toBe(l.pos[1]); // every lantern stands on the ground
  });
  it("30 mote points: 18 on tier 0, 8 on tier 1, 4 on tier 2; each stands on its tier", () => {
    expect(m.motePoints).toHaveLength(30);
    for (const p of m.motePoints) expect(m.height(p[0], p[2])).toBeCloseTo(p[1], 9);
    expect(m.motePoints.filter((p) => p[1] === 0)).toHaveLength(18);
    expect(m.motePoints.filter((p) => p[1] === 3)).toHaveLength(8);
    expect(m.motePoints.filter((p) => p[1] === 6)).toHaveLength(4);
  });
  it("16 shade points on r=43; launch pad (0,3,13) Y12 + 8 m/s toward −Z; two charms; wind; faster shades", () => {
    expect(m.shadePoints).toHaveLength(16);
    expect(m.shadePoints.every((p) => Math.abs(Math.hypot(p[0], p[2]) - 43) < 1e-9)).toBe(true);
    expect(m.pads).toEqual([{ pos: [0, 3, 13], vy: 12, hv: 8, dir: [0, -1] }]);
    expect(m.charms.map((c) => c.pos)).toEqual([[30, 0, 25], [-30, 0, 25]]);
    expect([m.shadeEveryTicks, m.shadeMax, m.shadeSpeed, m.wind, m.drifters]).toEqual([360, 10, 4.5, true, true]);
  });
  it("starts off the tower (0,0,0 is inside it)", () => {
    expect(m.height(m.start[0], m.start[2])).toBe(0);
  });
});

it("unknown night throws", () => {
  expect(() => getNight(4)).toThrow();
  expect(pts([[1.00049, 0, 2]])).toEqual([[1, 0, 2]]);
});
