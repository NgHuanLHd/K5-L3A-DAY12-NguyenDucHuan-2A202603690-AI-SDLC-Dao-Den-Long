// Standard maps from docs/lab/TICKET-02.md Part 2.
// Angles: measured from +X, counter-clockwise seen from above, on the XZ plane:
//   point = (cx + r cos θ, y, cz + r sin θ).
import type { Vec3 } from "./types.js";

const rad = (d: number) => (d * Math.PI) / 180;
const P = (r: number, deg: number, y = 0, cx = 0, cz = 0): Vec3 => [cx + r * Math.cos(rad(deg)), y, cz + r * Math.sin(rad(deg))];
const ring = (r: number, n: number, startDeg: number, stepDeg: number, y = 0, cx = 0, cz = 0): Vec3[] =>
  Array.from({ length: n }, (_, i) => P(r, startDeg + i * stepDeg, y, cx, cz));

export interface PadDef {
  /** Pad centre (y = pad height). Radius is PAD_RADIUS. */
  pos: Vec3;
  vy: number;
  /** Horizontal launch speed and unit direction. */
  hv: number;
  dir: [number, number];
}
export const PAD_RADIUS = 1;

export interface NightDef {
  night: 1 | 2 | 3;
  name: string;
  /** Ông Đăng's line shown on the intro screen. */
  intro: string;
  start: Vec3;
  facing: [number, number];
  lanterns: { id: string; pos: Vec3 }[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeEveryTicks: number;
  shadeMax: number;
  /** null = use tuning.shade_speed. */
  shadeSpeed: number | null;
  pads: PadDef[];
  charms: { id: string; pos: Vec3 }[];
  /** Round islands (for wandering and visuals). */
  islands: { cx: number; cz: number; r: number }[];
  drifters: boolean;
  wind: boolean;
  /** Height of the solid column under (x,z), or null over open sea. */
  height(x: number, z: number): number | null;
}

const toward = (from: Vec3, to: [number, number]): [number, number] => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[2];
  const l = Math.hypot(dx, dz);
  return [dx / l, dz / l];
};

// ---------------------------------------------------------------- Night 1
const night1: NightDef = {
  night: 1,
  name: "Đảo Bến",
  intro: "Đêm nay sương đen phủ kín Đảo Bến. Hãy gom đom đóm và thắp lại năm ngọn đèn đầu tiên, Mây.",
  start: [0, 0, 0],
  facing: [0, 1],
  lanterns: [
    { id: "L1", pos: [0, 0, 25] },
    { id: "L2", pos: [23.8, 0, 7.7] },
    { id: "L3", pos: [14.7, 0, -20.2] },
    { id: "L4", pos: [-14.7, 0, -20.2] },
    { id: "L5", pos: [-23.8, 0, 7.7] },
  ],
  motePoints: [...ring(12, 8, 0, 45), ...ring(33, 16, 0, 22.5)],
  shadePoints: ring(37, 12, 15, 30),
  shadeEveryTicks: 480,
  shadeMax: 6,
  shadeSpeed: null,
  pads: [],
  charms: [],
  islands: [{ cx: 0, cz: 0, r: 40 }],
  drifters: false,
  wind: false,
  height: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
};

// ---------------------------------------------------------------- Night 2
const B: [number, number] = [70, 0];
const night2: NightDef = {
  night: 2,
  name: "Đảo Cau",
  intro: "Hai hòn đảo nối nhau bằng cây cầu tre. Gió Lạc hay rình đom đóm, đừng mang nặng mà đứng yên nhé.",
  start: [0, 0, 0],
  facing: [0, 1],
  lanterns: [
    { id: "L1", pos: [0, 0, 20] },
    { id: "L2", pos: [17, 0, -10] },
    { id: "L3", pos: [-17, 0, -10] },
    { id: "L4", pos: [70, 0, 20] },
    { id: "L5", pos: [87, 0, -10] },
    { id: "L6", pos: [53, 0, -10] },
  ],
  motePoints: [
    ...ring(10, 4, 0, 90), ...ring(22, 8, 0, 45),
    ...ring(10, 4, 0, 90, 0, 70, 0), ...ring(22, 8, 0, 45, 0, 70, 0),
  ],
  shadePoints: [...ring(26, 8, 22.5, 45), ...ring(26, 8, 22.5, 45, 0, 70, 0)],
  shadeEveryTicks: 420,
  shadeMax: 8,
  shadeSpeed: null,
  pads: [
    { pos: [20, 0, 18], vy: 14, hv: 24, dir: toward([20, 0, 18], B) },
    { pos: [50, 0, -18], vy: 14, hv: 24, dir: toward([50, 0, -18], [0, 0]) },
  ],
  charms: [{ id: "C1", pos: [35, 0, 0] }],
  islands: [{ cx: 0, cz: 0, r: 28 }, { cx: 70, cz: 0, r: 28 }],
  drifters: true,
  wind: false,
  height: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // bamboo bridge
    return null;
  },
};

// ---------------------------------------------------------------- Night 3
export const N3_RAMP_ANGLES = [30, 150];
export const N3 = { R: 45, TIER1_Y: 3, TIER2_Y: 6, TIER2_R: 8, TOWER_R: 2, TOWER_TOP: 14, RING_IN: 12, RING_OUT: 24, RAMP_BASE_R: 30, RAMP_W: 3 };

function night3Height(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r > N3.R) return null;
  let h = 0;
  if (r <= N3.TOWER_R) h = N3.TOWER_TOP;
  else if (r <= N3.TIER2_R) h = N3.TIER2_Y;
  else if (z > 0 && r >= N3.RING_IN && r <= N3.RING_OUT) h = N3.TIER1_Y;
  for (const deg of N3_RAMP_ANGLES) {
    const ux = Math.cos(rad(deg));
    const uz = Math.sin(rad(deg));
    const s = x * ux + z * uz; // along the radius
    const d = Math.abs(-x * uz + z * ux); // across
    if (s >= N3.RING_OUT && s <= N3.RAMP_BASE_R && d <= N3.RAMP_W / 2) {
      h = Math.max(h, ((N3.RAMP_BASE_R - s) / (N3.RAMP_BASE_R - N3.RING_OUT)) * N3.TIER1_Y);
    }
  }
  return h;
}

const night3: NightDef = {
  night: 3,
  name: "Đảo Chuông",
  intro: "Đảo Chuông có ba tầng và gió dữ. Tháp chuông ở tâm đang chờ ánh sáng của em.",
  // (0,0,0) is inside the bell tower, so the start is on the lowest tier (see docs/notes/phase-2-plan.md Q3).
  start: [0, 0, -30],
  facing: [0, 1],
  lanterns: [
    { id: "L1", pos: [0, 6, 6] },
    { id: "L2", pos: [18, 3, 10] },
    { id: "L3", pos: [-18, 3, 10] },
    { id: "L4", pos: [35, 0, -10] },
    { id: "L5", pos: [-35, 0, -10] },
    { id: "L6", pos: [20, 0, -35] },
    { id: "L7", pos: [-20, 0, -35] },
  ],
  motePoints: [...ring(34, 18, 0, 20), ...ring(18, 8, 20, 20, 3), ...ring(5, 4, 45, 90, 6)],
  shadePoints: ring(43, 16, 0, 22.5),
  shadeEveryTicks: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], vy: 12, hv: 8, dir: [0, -1] }],
  charms: [{ id: "C1", pos: [30, 0, 25] }, { id: "C2", pos: [-30, 0, 25] }],
  islands: [{ cx: 0, cz: 0, r: 45 }],
  drifters: true,
  wind: true,
  height: night3Height,
};

const NIGHTS: Record<number, NightDef> = { 1: night1, 2: night2, 3: night3 };

export function getNight(n: number): NightDef {
  const def = NIGHTS[n];
  if (!def) throw new RangeError(`unknown night ${n}`);
  return def;
}
