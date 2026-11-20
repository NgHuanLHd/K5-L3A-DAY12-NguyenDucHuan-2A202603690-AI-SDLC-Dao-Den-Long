import {
  DT,
  GRAVITY,
  INITIAL_MOTES,
  ISLAND_RADIUS,
  JUMP_SPEED,
  LANTERN_RING_RADIUS,
  TICK_RATE,
} from "./constants.js";
import { createRng, type Rng } from "./rng.js";
import type {
  GameEvent,
  GameState,
  InputState,
  Lantern,
  Mote,
  Player,
  Scenario,
  Shade,
  Tuning,
  Vec3,
} from "./types.js";

export interface World {
  tuning: Tuning;
  rng: Rng;
  /** Number of steps executed so far (= tick of current state). */
  tick: number;
  state: GameState;
  /** time_left_s at tick 0 (night duration or scenario override). */
  timeStart: number;
  score: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  prev: InputState;
  nextMoteId: number;
  nextShadeId: number;
}

export const DEFAULT_INPUT: InputState = {
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
};

export function defaultLanterns(count: number): Lantern[] {
  const out: Lantern[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push({
      id: `L${i + 1}`,
      pos: [round3(Math.sin(a) * LANTERN_RING_RADIUS), 0, round3(Math.cos(a) * LANTERN_RING_RADIUS)],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

function randomIslandPoint(rng: Rng, minR: number, maxR: number): Vec3 {
  const a = rng() * Math.PI * 2;
  const r = minR + Math.sqrt(rng()) * (maxR - minR);
  return [round3(Math.sin(a) * r), 0, round3(Math.cos(a) * r)];
}

/** Build tick-0 state. Scenario setup emits no events and awards no points. */
export function createWorld(tuning: Tuning, seed: number, scenario: Scenario = {}): World {
  const rng = createRng(seed);
  const w: World = {
    tuning,
    rng,
    tick: 0,
    state: "playing",
    timeStart: tuning.night1_duration_s,
    score: 0,
    player: { pos: [0, 0, 0], vy: 0, flames: tuning.flames, carried: 0 },
    lanterns: defaultLanterns(tuning.lantern_count_night1),
    shades: [],
    motes: [],
    prev: { ...DEFAULT_INPUT, move: [0, 0] },
    nextMoteId: 1,
    nextShadeId: 1,
  };

  if (scenario.random_motes !== false) {
    for (let i = 0; i < INITIAL_MOTES; i++) {
      w.motes.push({ id: `M${w.nextMoteId++}`, pos: randomIslandPoint(rng, 3, ISLAND_RADIUS - 2) });
    }
  }
  // TODO(phase-1): random shade spawning when scenario.random_shades !== false.

  const p = scenario.player;
  if (p) {
    if (p.pos) w.player.pos = [...p.pos];
    if (p.carried !== undefined) w.player.carried = p.carried;
    if (p.flames !== undefined) w.player.flames = p.flames;
  }
  if (scenario.motes) {
    w.motes = scenario.motes.map((pos) => ({ id: `M${w.nextMoteId++}`, pos: [...pos] as Vec3 }));
  }
  if (scenario.shades) {
    w.shades = scenario.shades.map((s) => ({
      id: s.id ?? `S${w.nextShadeId++}`,
      pos: [...s.pos] as Vec3,
      state: "chase",
    }));
  }
  for (const l of scenario.lanterns ?? []) {
    const target = w.lanterns.find((x) => x.id === l.id);
    if (!target) continue;
    if (l.pos) target.pos = [...l.pos];
    if (l.lit !== undefined) target.lit = l.lit;
    if (l.deposited !== undefined) target.deposited = l.deposited;
  }
  if (scenario.time_left_s !== undefined) w.timeStart = scenario.time_left_s;
  return w;
}

export function timeLeft(w: World): number {
  return Math.max(0, w.timeStart - w.tick / TICK_RATE);
}

/** Contract movement: rotate [x,z] by camera yaw; normalise if longer than 1. */
export function worldMoveDir(move: [number, number], camYawDeg: number): [number, number] {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const t = (camYawDeg * Math.PI) / 180;
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
}

/** Step k: read input of tick k, produce state k+1. Events carry tick k+1. */
export function step(w: World, input: InputState): GameEvent[] {
  if (w.state !== "playing") return [];
  const events: GameEvent[] = [];
  const t = w.tick + 1;
  const pressed = (k: "jump" | "interact" | "pulse" | "dash") => input[k] && !w.prev[k];

  // Movement on XZ.
  const [dx, dz] = worldMoveDir(input.move, input.cam_yaw_deg);
  const pl = w.player;
  pl.pos[0] += dx * w.tuning.player_speed * DT;
  pl.pos[2] += dz * w.tuning.player_speed * DT;

  // Jump (Y only, does not affect XZ distances).
  if (pressed("jump") && pl.pos[1] <= 0) pl.vy = JUMP_SPEED;
  if (pl.pos[1] > 0 || pl.vy > 0) {
    pl.vy -= GRAVITY * DT;
    pl.pos[1] = Math.max(0, pl.pos[1] + pl.vy * DT);
    if (pl.pos[1] === 0) pl.vy = 0;
  }

  // TODO(phase-1): mote pickup, deposit/lantern_lit, shades chase/hit, pulse, scoring, win/lose.

  w.tick = t;
  w.prev = { ...input, move: [input.move[0], input.move[1]] };

  if (w.state === "playing" && timeLeft(w) <= 1e-9) {
    w.state = "lost";
    events.push({ type: "event", tick: t, name: "game_over", data: { result: "lost", reason: "dawn" } });
  }
  return events;
}

export function round3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

const r3 = (p: Vec3): Vec3 => [round3(p[0]), round3(p[1]), round3(p[2])];

export function snapshot(w: World) {
  return {
    type: "snapshot",
    tick: w.tick,
    sim_tick: w.tick,
    state: w.state,
    time_left_s: round3(timeLeft(w)),
    score: w.score,
    player: { pos: r3(w.player.pos), flames: w.player.flames, carried: w.player.carried },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: r3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: r3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: r3(m.pos) })),
  };
}
