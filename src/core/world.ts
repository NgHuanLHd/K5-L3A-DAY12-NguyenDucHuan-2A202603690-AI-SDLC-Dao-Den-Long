import {
  DT,
  EPS,
  GRAVITY,
  INITIAL_MOTES,
  ISLAND_RADIUS,
  JUMP_SPEED,
  LANTERN_RING_RADIUS,
  MOTE_MIN_R,
  MOTE_RESPAWN_EVERY_S,
  SAFE_MARGIN,
  SHADE_FIRST_SPAWN_S,
  SHADE_MAX,
  SHADE_SPAWN_EVERY_S,
  SHADE_SPAWN_R,
  SHADE_Y,
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

export type EndReason = "all_lit" | "dawn" | "no_flames";

export interface World {
  tuning: Tuning;
  rng: Rng;
  /** Number of steps executed so far (= tick of current state). */
  tick: number;
  state: GameState;
  endReason?: EndReason;
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
  randomMotes: boolean;
  randomShades: boolean;
  /** Player can be hit again from this tick on. */
  invulnUntil: number;
  /** Pulse usable again from this tick on. */
  pulseReadyAt: number;
  nextShadeSpawnTick: number;
  nextMoteSpawnTick: number;
}

export const DEFAULT_INPUT: InputState = {
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
};

const toTicks = (s: number) => Math.round(s * TICK_RATE);

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

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
    randomMotes: scenario.random_motes !== false,
    randomShades: scenario.random_shades !== false,
    invulnUntil: 0,
    pulseReadyAt: 0,
    nextShadeSpawnTick: toTicks(SHADE_FIRST_SPAWN_S),
    nextMoteSpawnTick: toTicks(MOTE_RESPAWN_EVERY_S),
  };

  if (w.randomMotes) {
    for (let i = 0; i < INITIAL_MOTES; i++) {
      w.motes.push({ id: `M${w.nextMoteId++}`, pos: randomIslandPoint(rng, MOTE_MIN_R, ISLAND_RADIUS - 2) });
    }
  }

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
      id: s.id ?? newShadeId(w),
      pos: [...s.pos] as Vec3,
      state: "chase",
      stunnedUntil: 0,
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

function newShadeId(w: World): string {
  let id = `S${w.nextShadeId++}`;
  while (w.shades.some((s) => s.id === id)) id = `S${w.nextShadeId++}`;
  return id;
}

export function timeLeftAt(w: World, tick: number): number {
  return Math.max(0, w.timeStart - tick / TICK_RATE);
}

export function timeLeft(w: World): number {
  return timeLeftAt(w, w.tick);
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

/** Keep a point inside a circle on XZ. */
function clampToIsland(pos: Vec3): void {
  const r = Math.hypot(pos[0], pos[2]);
  if (r > ISLAND_RADIUS) {
    pos[0] *= ISLAND_RADIUS / r;
    pos[2] *= ISLAND_RADIUS / r;
  }
}

/** Push a shade out of every lit lantern's safe zone (shades fear lanterns). */
function keepOutOfSafeZones(w: World, pos: Vec3): void {
  const r = w.tuning.safe_radius + SAFE_MARGIN;
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    const dx = pos[0] - l.pos[0];
    const dz = pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < r) {
      const [ux, uz] = d > EPS ? [dx / d, dz / d] : [1, 0];
      pos[0] = l.pos[0] + ux * r;
      pos[2] = l.pos[2] + uz * r;
    }
  }
}

/**
 * Step k: read input of tick k, produce state k+1. Events carry tick k+1.
 * Order: move/jump -> pickup -> interact -> pulse -> shades move -> shade hits -> spawns -> dawn.
 * Once the game ends, the remaining phases of that step are skipped.
 */
export function step(w: World, input: InputState): GameEvent[] {
  if (w.state !== "playing") return [];
  const T = w.tuning;
  const events: GameEvent[] = [];
  const t = w.tick + 1;
  const emit = (name: GameEvent["name"], data: Record<string, unknown>) =>
    events.push({ type: "event", tick: t, name, data });
  const pressed = (k: "jump" | "interact" | "pulse" | "dash") => input[k] && !w.prev[k];
  const pl = w.player;

  const end = (result: "won" | "lost", reason: EndReason) => {
    w.state = result;
    w.endReason = reason;
    if (result === "won") {
      w.score += T.score.per_second_left * Math.floor(timeLeftAt(w, t) + EPS) + T.score.per_flame_left * pl.flames;
    }
    emit("game_over", { result, reason });
  };

  // 1. Movement on XZ, kept on the island.
  const [dx, dz] = worldMoveDir(input.move, input.cam_yaw_deg);
  pl.pos[0] += dx * T.player_speed * DT;
  pl.pos[2] += dz * T.player_speed * DT;
  clampToIsland(pl.pos);

  // 2. Jump (Y only; never affects XZ distances).
  if (pressed("jump") && pl.pos[1] <= 0) pl.vy = JUMP_SPEED;
  if (pl.pos[1] > 0 || pl.vy > 0) {
    pl.vy -= GRAVITY * DT;
    pl.pos[1] = Math.max(0, pl.pos[1] + pl.vy * DT);
    if (pl.pos[1] === 0) pl.vy = 0;
  }

  // 3. Pick up motes within pickup_radius while there is room.
  const kept: Mote[] = [];
  for (const m of w.motes) {
    if (pl.carried < T.carry_capacity && distXZ(m.pos, pl.pos) <= T.pickup_radius + EPS) {
      pl.carried++;
      w.score += T.score.per_mote;
      emit("mote_picked", { carried: pl.carried });
    } else kept.push(m);
  }
  w.motes = kept;

  // 4. Interact: deposit into the nearest unlit lantern within interact_radius.
  if (pressed("interact") && pl.carried > 0) {
    let best: Lantern | undefined;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (l.lit) continue;
      const d = distXZ(l.pos, pl.pos);
      if (d <= T.interact_radius + EPS && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(pl.carried, Math.max(0, T.lantern_cost - best.deposited));
      if (amount > 0) {
        pl.carried -= amount;
        best.deposited += amount;
        emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        w.score += T.score.per_lantern;
        emit("lantern_lit", { lantern_id: best.id });
        if (w.lanterns.every((l) => l.lit)) end("won", "all_lit");
      }
    }
  }

  // 5. Pulse: costs light, stuns + pushes shades within pulse_radius.
  if (w.state === "playing" && pressed("pulse") && t >= w.pulseReadyAt && pl.carried >= T.pulse_cost) {
    pl.carried -= T.pulse_cost;
    w.pulseReadyAt = t + toTicks(T.pulse_cooldown_s);
    const stunned: string[] = [];
    for (const s of w.shades) {
      const d = distXZ(s.pos, pl.pos);
      if (d > T.pulse_radius + EPS) continue;
      s.state = "stunned";
      s.stunnedUntil = t + toTicks(T.pulse_stun_s);
      const [ux, uz] = d > EPS ? [(s.pos[0] - pl.pos[0]) / d, (s.pos[2] - pl.pos[2]) / d] : [1, 0];
      s.pos[0] += ux * T.pulse_push_m;
      s.pos[2] += uz * T.pulse_push_m;
      clampToIsland(s.pos);
      keepOutOfSafeZones(w, s.pos);
      stunned.push(s.id);
    }
    w.score += T.score.per_stun * stunned.length;
    emit("pulse", { stunned_ids: stunned });
  }

  if (w.state === "playing") {
    // 6. Shades: recover from stun, chase the player, never enter a lit lantern's safe zone.
    for (const s of w.shades) {
      if (s.state === "stunned" && t >= s.stunnedUntil) s.state = "chase";
      if (s.state !== "stunned") {
        const d = distXZ(s.pos, pl.pos);
        const stepLen = Math.min(T.shade_speed * DT, d);
        if (d > EPS) {
          s.pos[0] += ((pl.pos[0] - s.pos[0]) / d) * stepLen;
          s.pos[2] += ((pl.pos[2] - s.pos[2]) / d) * stepLen;
        }
      }
      keepOutOfSafeZones(w, s.pos);
    }

    // 7. Shade touches player (not stunned, not invulnerable): lose a flame, drop light.
    if (t >= w.invulnUntil) {
      const hitter = w.shades.find((s) => s.state !== "stunned" && distXZ(s.pos, pl.pos) <= T.shade_hit_radius + EPS);
      if (hitter) {
        pl.flames = Math.max(0, pl.flames - 1);
        const dropped = Math.floor(pl.carried * T.hit_drop_ratio + EPS);
        pl.carried -= dropped;
        w.invulnUntil = t + toTicks(T.invuln_s);
        emit("player_hit", { by: "shade", flames: pl.flames, dropped });
        if (pl.flames <= 0) end("lost", "no_flames");
      }
    }
  }

  if (w.state === "playing") {
    // 8. Spawns (only when the scenario allows random entities).
    if (w.randomShades && t >= w.nextShadeSpawnTick) {
      w.nextShadeSpawnTick += toTicks(SHADE_SPAWN_EVERY_S);
      if (w.shades.length < SHADE_MAX) {
        for (let tries = 0; tries < 8; tries++) {
          const a = w.rng() * Math.PI * 2;
          const pos: Vec3 = [round3(Math.sin(a) * SHADE_SPAWN_R), SHADE_Y, round3(Math.cos(a) * SHADE_SPAWN_R)];
          const safe = w.lanterns.some((l) => l.lit && distXZ(l.pos, pos) <= T.safe_radius + EPS);
          if (safe) continue;
          const id = newShadeId(w);
          w.shades.push({ id, pos, state: "chase", stunnedUntil: 0 });
          emit("shade_spawned", { id });
          break;
        }
      }
    }
    if (w.randomMotes && t >= w.nextMoteSpawnTick) {
      w.nextMoteSpawnTick += toTicks(MOTE_RESPAWN_EVERY_S);
      if (w.motes.length < INITIAL_MOTES) {
        w.motes.push({ id: `M${w.nextMoteId++}`, pos: randomIslandPoint(w.rng, MOTE_MIN_R, ISLAND_RADIUS - 2) });
      }
    }
  }

  w.tick = t;
  w.prev = { ...input, move: [input.move[0], input.move[1]] };

  // 9. Dawn: night is over before all lanterns are lit.
  if (w.state === "playing" && timeLeft(w) <= EPS) end("lost", "dawn");
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
