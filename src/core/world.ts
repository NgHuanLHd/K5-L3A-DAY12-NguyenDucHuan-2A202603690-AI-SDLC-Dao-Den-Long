// All game rules (TICKET-02). Pure TypeScript, deterministic, shared by headless CLI and the 3D client.
// step() follows the ticket's mandatory 12-step tick order; each step is one function below.
import {
  ACCEL_TIME_S, CHARM_RESPAWN_TICKS, CHARM_SPEED, CHARM_TICKS, DRIFTER_CHASE_CARRIED, DRIFTER_CHASE_DIST,
  DRIFTER_DROP_VANISH_TICKS, DRIFTER_FLEE_TICKS, DRIFTER_HEIGHT, DRIFTER_IDLE_SPEED, DRIFTER_MAX, DRIFTER_SPAWN_EVERY,
  DRIFTER_SPEED, DRIFTER_STEAL_AMOUNT, DRIFTER_STEAL_DIST, DROP_RING_MAX, DROP_RING_MIN, DROPPED_TTL, DT, EPS, FALL_Y,
  GRAVITY, INVULN_AFTER_RESPAWN_TICKS, JUMP_SPEED, MOTE_MAX, MOTE_SPAWN_EVERY, MOTE_START, PICK_DY, PULSE_CENTER_UP,
  PULSE_PUSH_TICKS, RESPAWN_WAIT_TICKS, SAFE_EPS, SAFE_EVICT_TICKS, SHADE_CENTER_UP, SHADE_DETECT,
  SHADE_FIRST_SPAWN_COUNT, SHADE_FIRST_SPAWN_TICK, SHADE_LOSE, SHADE_RECOIL_M, SHADE_RECOIL_TICKS,
  SHADE_SPAWN_MIN_PLAYER_DIST, SHADE_WANDER_FACTOR, STEP_DOWN, STEP_UP, TICK_RATE, toTicks, WIND_EVERY, WIND_SPEED, WIND_TICKS,
} from "./constants.js";
import { getNight, PAD_RADIUS, type NightDef } from "./maps.js";
import { createRng, type Rng } from "./rng.js";
import type {
  Charm, Drifter, EventName, GameEvent, GameState, InputState, Lantern, Mote, Player, Scenario, Shade, ShadeState,
  Tuning, Vec3, Wind,
} from "./types.js";

export type EndReason = "all_lit" | "dawn" | "no_flames";

export interface World {
  tuning: Tuning;
  map: NightDef;
  night: number;
  rng: Rng;
  /** Wall steps executed (includes paused steps). */
  tick: number;
  /** Gameplay steps executed (frozen while paused). */
  simTick: number;
  state: GameState;
  endReason?: EndReason;
  timeLeftTicks: number;
  score: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  drifters: Drifter[];
  charms: Charm[];
  wind: Wind;
  windEnabled: boolean;
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  prev: InputState;
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
}

export const DEFAULT_INPUT: InputState = {
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
};

// ------------------------------------------------------------------ helpers
const idNum = (id: string) => parseInt(id.replace(/\D+/g, ""), 10) || 0;
const cmpId = (a: { id: string }, b: { id: string }) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const dxz = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
export const distXZ = (a: Vec3, b: Vec3) => dxz(a[0], a[2], b[0], b[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Unit vector from (fx,fz) to (tx,tz); +X when they coincide (ticket rule). */
function unit(fx: number, fz: number, tx: number, tz: number): [number, number] {
  const d = dxz(fx, fz, tx, tz);
  return d > EPS ? [(tx - fx) / d, (tz - fz) / d] : [1, 0];
}
export function round3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
const r3 = (p: Vec3): Vec3 => [round3(p[0]), round3(p[1]), round3(p[2])];
const dec = (n: number) => (n > 0 ? n - 1 : 0);

export function nightDurationS(t: Tuning, night: number): number {
  return night === 1 ? t.night1_duration_s : night === 2 ? t.night2_duration_s : t.night3_duration_s;
}
export const shadeSpeedOf = (w: World) => w.map.shadeSpeed ?? w.tuning.shade_speed;

/** Contract movement: rotate [x,z] by camera yaw; normalise if longer than 1. */
export function worldMoveDir(move: [number, number], camYawDeg: number): [number, number] {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  const t = (camYawDeg * Math.PI) / 180;
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
}

/**
 * Horizontal move with walls: blocked when the target column is higher than footY + STEP_UP.
 * Open sea (height null) is walkable only when allowVoid (the player may fall; shades may not).
 * Falls back to sliding along each axis. Returns whether it moved.
 */
function tryMove(map: NightDef, pos: Vec3, footY: number, dx: number, dz: number, allowVoid: boolean): boolean {
  for (const [ax, az] of [[dx, dz], [dx, 0], [0, dz]] as [number, number][]) {
    if (ax === 0 && az === 0) continue;
    const nx = pos[0] + ax;
    const nz = pos[2] + az;
    const h = map.height(nx, nz);
    if (h === null ? !allowVoid : h > footY + STEP_UP + EPS) continue;
    pos[0] = nx;
    pos[2] = nz;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ creation
/** Build tick-0 state. Scenario setup emits no events and awards no points. */
export function createWorld(tuning: Tuning, seed: number, night: number, scenario: Scenario = {}): World {
  const map = getNight(night);
  const rng = createRng(seed);
  const startY = map.height(map.start[0], map.start[2]) ?? 0;
  const w: World = {
    tuning, map, night, rng, tick: 0, simTick: 0, state: "playing",
    timeLeftTicks: toTicks(nightDurationS(tuning, night)),
    score: 0,
    player: {
      pos: [map.start[0], startY, map.start[2]], vel: [0, 0, 0], flames: tuning.flames, carried: 0, grounded: true,
      facing: [...map.facing], invuln: 0, dashTicks: 0, dashDir: [...map.facing], dashCd: 0, pulseCd: 0, charm: 0,
      launched: false, launchVel: [0, 0], respawnWait: 0,
    },
    lanterns: map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos] as Vec3, lit: false, deposited: 0, litAt: -1 })),
    shades: [], motes: [], drifters: [],
    charms: map.charms.map((c) => ({ id: c.id, pos: [...c.pos] as Vec3, available: true, respawn: 0 })),
    wind: { active: false, dirDeg: 0, ticksLeft: 0 },
    windEnabled: scenario.wind_enabled ?? map.wind,
    randomMotes: scenario.random_motes !== false,
    randomShades: scenario.random_shades !== false,
    randomDrifters: scenario.random_drifters ?? map.drifters,
    prev: { ...DEFAULT_INPUT, move: [0, 0] },
    nextMoteId: 1, nextShadeId: 1, nextDrifterId: 1,
  };

  if (w.randomMotes) {
    const pts = [...map.motePoints];
    const n = Math.min(MOTE_START, pts.length);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(rng() * (pts.length - i));
      [pts[i], pts[j]] = [pts[j]!, pts[i]!];
      w.motes.push({ id: `M${w.nextMoteId++}`, pos: [...pts[i]!] as Vec3, kind: "random", ttl: null });
    }
  }

  const sp = scenario.player;
  if (sp) {
    const p = w.player;
    if (sp.pos) p.pos = [...sp.pos];
    if (sp.carried !== undefined) p.carried = sp.carried;
    if (sp.flames !== undefined) p.flames = sp.flames;
    if (sp.invuln_ticks !== undefined) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks !== undefined) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks !== undefined) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks !== undefined) p.charm = sp.charm_ticks;
    const h = map.height(p.pos[0], p.pos[2]);
    p.grounded = h !== null && Math.abs(p.pos[1] - h) < 1e-6;
  }
  if (scenario.motes) {
    w.motes = scenario.motes.map((m) => {
      const o: { pos: Vec3; kind?: "random" | "dropped"; ttl_s?: number | null } = Array.isArray(m) ? { pos: m } : m;
      const kind = o.kind ?? "random";
      const ttl = kind === "dropped" ? (o.ttl_s !== undefined && o.ttl_s !== null ? toTicks(o.ttl_s) : DROPPED_TTL) : null;
      return { id: `M${w.nextMoteId++}`, pos: [...o.pos] as Vec3, kind, ttl };
    });
  }
  if (scenario.shades) {
    w.shades = scenario.shades.map((s) => {
      const state: ShadeState = s.state ?? "wander";
      const left = s.state_ticks_left ?? 0;
      return {
        id: s.id ?? freshShadeId(w), pos: [...s.pos] as Vec3, state,
        stunTicks: state === "stunned" ? left : 0, pushTicks: 0, pushDir: [1, 0],
        recoilTicks: state === "recoil" ? left : 0, evict: 0, evictFrom: null, waypoint: null,
      };
    });
  }
  if (scenario.drifters) {
    w.drifters = scenario.drifters.map((d) => {
      const state = d.state ?? "idle";
      return {
        id: d.id ?? `D${w.nextDrifterId++}`, pos: [...d.pos] as Vec3, state, stolen: d.stolen ?? 0,
        ticks: d.state_ticks_left ?? (state === "flee" ? DRIFTER_FLEE_TICKS : 0), waypoint: null,
      };
    });
  }
  if (scenario.charms) {
    w.charms = scenario.charms.map((c) => {
      const base = map.charms.find((x) => x.id === c.id);
      return {
        id: c.id, pos: [...(c.pos ?? base?.pos ?? map.start)] as Vec3, available: c.available ?? true,
        respawn: c.respawn_ticks ?? 0,
      };
    });
  }
  for (const l of scenario.lanterns ?? []) {
    const target = w.lanterns.find((x) => x.id === l.id);
    if (!target) continue;
    if (l.pos) target.pos = [...l.pos];
    if (l.lit !== undefined) target.lit = l.lit;
    if (l.deposited !== undefined) target.deposited = l.deposited;
  }
  if (scenario.time_left_s !== undefined) w.timeLeftTicks = toTicks(scenario.time_left_s);
  return w;
}

function freshShadeId(w: World): string {
  let id = `S${w.nextShadeId++}`;
  while (w.shades.some((s) => s.id === id)) id = `S${w.nextShadeId++}`;
  return id;
}

export const timeLeftSeconds = (w: World) => w.timeLeftTicks / TICK_RATE;

// ------------------------------------------------------------------ step
interface Ctx {
  w: World;
  input: InputState;
  emit: (name: EventName, data?: Record<string, unknown>) => void;
  pressed: (k: "jump" | "interact" | "pulse" | "dash") => boolean;
}

/**
 * One tick. Mandatory order (TICKET-02): 1 input/pause, 2 counters, 3 move player, 4 pickups, 5 interact,
 * 6 safe zones, 7 pulse, 8 move enemies, 9 contacts, 10 spawns, 11 win/lose, 12 snapshot (caller).
 */
export function step(w: World, input: InputState): GameEvent[] {
  if (w.state === "won" || w.state === "lost") return [];
  const ev: GameEvent[] = [];
  const t = ++w.tick;
  const emit = (name: EventName, data: Record<string, unknown> = {}) => ev.push({ type: "event", tick: t, name, data });
  const pressedKey = (k: keyof InputState) => !!input[k] && !w.prev[k];
  const finish = () => {
    w.prev = { ...input, move: [input.move[0], input.move[1]] };
    return ev;
  };

  // 1. pause first; a step that just paused stops here.
  if (pressedKey("pause")) {
    if (w.state === "playing") {
      w.state = "paused";
      emit("paused");
      return finish();
    }
    w.state = "playing";
    emit("resumed");
  } else if (w.state === "paused") return finish();

  w.simTick++;
  const c: Ctx = { w, input, emit, pressed: (k) => pressedKey(k) };
  tickCounters(c);
  movePlayer(c);
  pickups(c);
  interact(c);
  safeZones(c);
  pulse(c);
  moveEnemies(c);
  contacts(c);
  spawns(c);
  checkEnd(c);
  return finish();
}

// 2 ---------------------------------------------------------------- counters
function tickCounters({ w }: Ctx): void {
  const p = w.player;
  w.timeLeftTicks = dec(w.timeLeftTicks);
  p.dashCd = dec(p.dashCd);
  p.pulseCd = dec(p.pulseCd);
  p.invuln = dec(p.invuln);
  p.charm = dec(p.charm);
  for (const c of w.charms) {
    if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
  }
  w.motes = w.motes.filter((m) => {
    if (m.ttl === null) return true;
    m.ttl--;
    return m.ttl > 0;
  });
  for (const s of w.shades) s.stunTicks = dec(s.stunTicks);
  if (w.wind.active && --w.wind.ticksLeft <= 0) w.wind.active = false;
  if (w.windEnabled && w.simTick % WIND_EVERY === 0) {
    w.wind = { active: true, ticksLeft: WIND_TICKS, dirDeg: round3(w.rng() * 360) };
  }
  if (p.respawnWait > 0 && --p.respawnWait === 0) respawn(w);
}

function respawn(w: World): void {
  const p = w.player;
  const m = w.map;
  p.pos = [m.start[0], m.height(m.start[0], m.start[2]) ?? 0, m.start[2]];
  p.vel = [0, 0, 0];
  p.grounded = true;
  p.facing = [...m.facing];
  p.launched = false;
  p.dashTicks = 0;
  p.invuln = INVULN_AFTER_RESPAWN_TICKS;
}

// 3 ---------------------------------------------------------------- player movement
function movePlayer({ w, input, emit, pressed }: Ctx): void {
  const p = w.player;
  if (p.respawnWait > 0) return;
  const T = w.tuning;
  const move = worldMoveDir(input.move, input.cam_yaw_deg);
  const mlen = Math.hypot(move[0], move[1]);
  if (mlen > EPS) p.facing = [move[0] / mlen, move[1] / mlen];
  const maxSpeed = p.charm > 0 ? CHARM_SPEED : T.player_speed;

  // Dash: needs a fresh press, no dash in progress, and (cooldown over or charm active).
  if (pressed("dash") && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
    p.dashTicks = toTicks(T.dash_duration_s);
    p.dashDir = [...p.facing];
    if (p.charm === 0) p.dashCd = toTicks(T.dash_cooldown_s);
    emit("dash", {});
  }
  const dashing = p.dashTicks > 0;
  if (pressed("jump") && p.grounded && !dashing) {
    p.vel[1] = JUMP_SPEED;
    p.grounded = false;
  }

  // Horizontal velocity: dash > launch (keys do not override) > run with 0.1 s acceleration.
  const target: [number, number] = [move[0] * maxSpeed, move[1] * maxSpeed];
  if (dashing) {
    p.vel[0] = p.dashDir[0] * T.dash_speed;
    p.vel[2] = p.dashDir[1] * T.dash_speed;
  } else if (p.launched) {
    p.vel[0] = p.launchVel[0];
    p.vel[2] = p.launchVel[1];
  } else {
    const dvx = target[0] - p.vel[0];
    const dvz = target[1] - p.vel[2];
    const len = Math.hypot(dvx, dvz);
    const maxDv = (maxSpeed / ACCEL_TIME_S) * DT;
    if (len <= maxDv) { p.vel[0] = target[0]; p.vel[2] = target[1]; }
    else { p.vel[0] += (dvx / len) * maxDv; p.vel[2] += (dvz / len) * maxDv; }
  }
  tryMove(w.map, p.pos, p.pos[1], p.vel[0] * DT, p.vel[2] * DT, true);
  if (w.wind.active) {
    const a = (w.wind.dirDeg * Math.PI) / 180;
    tryMove(w.map, p.pos, p.pos[1], Math.cos(a) * WIND_SPEED * DT, Math.sin(a) * WIND_SPEED * DT, true);
  }

  // Vertical: glued to terrain while grounded; a dash keeps the current height.
  if (!dashing) {
    const h = w.map.height(p.pos[0], p.pos[2]);
    if (p.grounded && p.vel[1] <= 0 && h !== null && p.pos[1] - h <= STEP_DOWN + EPS && p.pos[1] - h >= -STEP_UP - EPS) {
      p.pos[1] = h;
      p.vel[1] = 0;
    } else {
      p.grounded = false;
      p.vel[1] -= GRAVITY * DT;
      p.pos[1] += p.vel[1] * DT;
      if (h !== null && p.pos[1] <= h && p.vel[1] <= 0) {
        p.pos[1] = h;
        p.vel[1] = 0;
        p.grounded = true;
      }
    }
    if (p.launched && p.grounded) p.launched = false;
  }

  // Launch pads.
  if (p.grounded && !dashing) {
    for (const pad of w.map.pads) {
      if (dxz(p.pos[0], p.pos[2], pad.pos[0], pad.pos[2]) <= PAD_RADIUS + EPS && Math.abs(p.pos[1] - pad.pos[1]) <= 0.5) {
        p.vel[1] = pad.vy;
        p.grounded = false;
        p.launched = true;
        p.launchVel = [pad.dir[0] * pad.hv, pad.dir[1] * pad.hv];
        p.vel[0] = p.launchVel[0];
        p.vel[2] = p.launchVel[1];
        break;
      }
    }
  }

  if (dashing && --p.dashTicks === 0) {
    // Back to the velocity the dash interrupted.
    if (p.launched) { p.vel[0] = p.launchVel[0]; p.vel[2] = p.launchVel[1]; }
    else { p.vel[0] = target[0]; p.vel[2] = target[1]; }
  }

  // Falling off the island happens exactly once per fall and ignores invulnerability.
  if (p.pos[1] < FALL_Y) {
    const lost = p.carried;
    p.carried = 0;
    p.flames = Math.max(0, p.flames - 1);
    emit("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost });
    if (p.flames > 0) p.respawnWait = RESPAWN_WAIT_TICKS;
  }
}

// 4 ---------------------------------------------------------------- pickups
function pickups({ w, emit }: Ctx): void {
  const p = w.player;
  if (p.respawnWait > 0) return;
  const T = w.tuning;
  const near = (pos: Vec3) =>
    dxz(pos[0], pos[2], p.pos[0], p.pos[2]) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - pos[1]) <= PICK_DY + EPS;
  const kept: Mote[] = [];
  for (const m of w.motes) {
    if (p.carried < T.carry_capacity && near(m.pos)) {
      p.carried++;
      emit("mote_picked", { carried: p.carried });
    } else kept.push(m);
  }
  w.motes = kept;
  for (const c of w.charms) {
    if (c.available && near(c.pos)) {
      c.available = false;
      c.respawn = CHARM_RESPAWN_TICKS;
      p.charm = CHARM_TICKS; // picking again refreshes
      emit("charm_picked", { charm_id: c.id, charm_ticks: CHARM_TICKS });
    }
  }
}

// 5 ---------------------------------------------------------------- lanterns
function interact({ w, emit, pressed }: Ctx): void {
  const p = w.player;
  if (p.respawnWait > 0 || !pressed("interact") || p.carried <= 0) return;
  const T = w.tuning;
  let best: Lantern | undefined;
  let bestD = Infinity;
  for (const l of w.lanterns) {
    if (l.lit) continue;
    const d = distXZ(l.pos, p.pos);
    // Nearest wins; on a tie the smaller id (lanterns are in id order, so strict < keeps it).
    if (d <= T.interact_radius + EPS && d < bestD - EPS) { best = l; bestD = d; }
  }
  if (!best) return;
  const amount = Math.min(p.carried, Math.max(0, T.lantern_cost - best.deposited));
  if (amount <= 0) return;
  p.carried -= amount;
  best.deposited += amount;
  w.score += T.score.per_mote * amount;
  emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
  if (best.deposited >= T.lantern_cost) {
    best.lit = true;
    best.litAt = w.simTick;
    w.score += T.score.per_lantern;
    emit("lantern_lit", { lantern_id: best.id });
  }
}

// 6 ---------------------------------------------------------------- safe zones
/** Shades inside a lantern that was just lit are pushed to the 6 m edge (<= 30 ticks, harmless meanwhile). */
function safeZones({ w }: Ctx): void {
  const R = w.tuning.safe_radius;
  for (const l of w.lanterns) {
    if (!l.lit || l.litAt !== w.simTick) continue;
    for (const s of w.shades) {
      if (distXZ(s.pos, l.pos) <= R + EPS) { s.evict = SAFE_EVICT_TICKS; s.evictFrom = l.id; }
    }
  }
  for (const s of w.shades) {
    if (s.evict <= 0) continue;
    const l = w.lanterns.find((x) => x.id === s.evictFrom);
    if (!l) { s.evict = 0; continue; }
    const d = distXZ(s.pos, l.pos);
    if (d >= R) { s.evict = 0; continue; }
    const [ux, uz] = unit(l.pos[0], l.pos[2], s.pos[0], s.pos[2]);
    const m = Math.min(R - d, R / SAFE_EVICT_TICKS);
    s.pos[0] += ux * m;
    s.pos[2] += uz * m;
    s.evict--;
    groundShade(w, s);
  }
}

/** After any movement: keep a shade out of every lit lantern's zone (it stops at the 6 m edge). */
function clampSafe(w: World, s: Shade): void {
  const R = w.tuning.safe_radius;
  for (const l of w.lanterns) {
    if (!l.lit || (s.evict > 0 && s.evictFrom === l.id)) continue;
    const d = distXZ(s.pos, l.pos);
    if (d < R) {
      const [ux, uz] = unit(l.pos[0], l.pos[2], s.pos[0], s.pos[2]);
      s.pos[0] = l.pos[0] + ux * (R + SAFE_EPS);
      s.pos[2] = l.pos[2] + uz * (R + SAFE_EPS);
    }
  }
}

function groundShade(w: World, s: Shade): void {
  const h = w.map.height(s.pos[0], s.pos[2]);
  if (h !== null) s.pos[1] = h + SHADE_CENTER_UP;
}
const shadeFoot = (w: World, s: Shade) => w.map.height(s.pos[0], s.pos[2]) ?? s.pos[1] - SHADE_CENTER_UP;

// 7 ---------------------------------------------------------------- pulse (Tỏa Sáng)
function pulse({ w, emit, pressed }: Ctx): void {
  const p = w.player;
  const T = w.tuning;
  if (p.respawnWait > 0 || !pressed("pulse") || p.pulseCd > 0 || p.carried < T.pulse_cost) return;
  p.carried -= T.pulse_cost;
  p.pulseCd = toTicks(T.pulse_cooldown_s);
  const centre: Vec3 = [p.pos[0], p.pos[1] + PULSE_CENTER_UP, p.pos[2]];
  const hit: string[] = [];
  for (const s of w.shades) {
    if (dist3(centre, s.pos) > T.pulse_radius + EPS) continue;
    s.state = "stunned";
    s.stunTicks = toTicks(T.pulse_stun_s);
    s.pushTicks = PULSE_PUSH_TICKS;
    s.pushDir = unit(p.pos[0], p.pos[2], s.pos[0], s.pos[2]);
    s.recoilTicks = 0;
    w.score += T.score.per_stun;
    hit.push(s.id);
  }
  for (const d of w.drifters) {
    if (d.state === "removed" || dist3(centre, d.pos) > T.pulse_radius + EPS) continue;
    if (d.state === "chase") {
      d.state = "flee";
      d.ticks = DRIFTER_FLEE_TICKS;
    } else if (d.state === "flee" && d.stolen > 0) {
      const amount = d.stolen;
      d.stolen = 0;
      d.ticks = DRIFTER_DROP_VANISH_TICKS;
      const h = w.map.height(d.pos[0], d.pos[2]) ?? p.pos[1];
      for (let i = 0; i < amount; i++) {
        w.motes.push({ id: `M${w.nextMoteId++}`, pos: [d.pos[0], h, d.pos[2]], kind: "dropped", ttl: DROPPED_TTL });
      }
      emit("drifter_drop", { drifter_id: d.id, amount });
    }
  }
  emit("pulse", { stunned_ids: hit });
}

// 8 ---------------------------------------------------------------- enemies
/** Random point on the nearest island. For walkers, prefer a point on the same level (not behind a wall). */
function randomWaypoint(w: World, x: number, z: number, footY: number | null): [number, number] {
  let best = w.map.islands[0]!;
  for (const isl of w.map.islands) if (dxz(x, z, isl.cx, isl.cz) < dxz(x, z, best.cx, best.cz)) best = isl;
  let wp: [number, number] = [best.cx, best.cz];
  for (let tries = 0; tries < 6; tries++) {
    const a = w.rng() * Math.PI * 2;
    const r = Math.sqrt(w.rng()) * best.r * 0.8;
    wp = [best.cx + Math.cos(a) * r, best.cz + Math.sin(a) * r];
    const h = w.map.height(wp[0], wp[1]);
    if (footY === null || (h !== null && Math.abs(h - footY) <= STEP_UP)) break;
  }
  return wp;
}
/** Re-pick wander targets every 2 s so nobody hugs a wall forever (staggered by id). */
const repick = (w: World, id: string) => (w.simTick + idNum(id) * 7) % 120 === 0;

function shadeStep(w: World, s: Shade, tx: number, tz: number, speed: number): boolean {
  const d = dxz(s.pos[0], s.pos[2], tx, tz);
  const m = Math.min(speed * DT, d);
  if (m <= EPS) return false;
  const [ux, uz] = unit(s.pos[0], s.pos[2], tx, tz);
  return tryMove(w.map, s.pos, shadeFoot(w, s), ux * m, uz * m, false);
}

function moveEnemies({ w }: Ctx): void {
  const p = w.player;
  const speed = shadeSpeedOf(w);
  const detect = (s: Shade): ShadeState => (distXZ(s.pos, p.pos) <= SHADE_DETECT ? "chase" : "wander");
  for (const s of w.shades) {
    if ((s.state === "stunned" && s.stunTicks === 0) || s.state === "spawning") s.state = detect(s);
    if (s.state === "stunned") {
      if (s.pushTicks > 0) {
        const m = w.tuning.pulse_push_m / PULSE_PUSH_TICKS;
        tryMove(w.map, s.pos, shadeFoot(w, s), s.pushDir[0] * m, s.pushDir[1] * m, false);
        s.pushTicks--;
      }
    } else if (s.evict > 0) {
      // being pushed out of a new safe zone: handled in safeZones()
    } else if (s.state === "recoil") {
      const [ux, uz] = unit(p.pos[0], p.pos[2], s.pos[0], s.pos[2]);
      const m = SHADE_RECOIL_M / SHADE_RECOIL_TICKS;
      tryMove(w.map, s.pos, shadeFoot(w, s), ux * m, uz * m, false);
      if (--s.recoilTicks <= 0) s.state = detect(s);
    } else {
      const d = distXZ(s.pos, p.pos);
      if (s.state === "wander" && d <= SHADE_DETECT) s.state = "chase";
      else if (s.state === "chase" && d > SHADE_LOSE) s.state = "wander";
      if (s.state === "chase") shadeStep(w, s, p.pos[0], p.pos[2], speed);
      else {
        if (!s.waypoint || repick(w, s.id) || dxz(s.pos[0], s.pos[2], s.waypoint[0], s.waypoint[1]) < 0.5) {
          s.waypoint = randomWaypoint(w, s.pos[0], s.pos[2], shadeFoot(w, s));
        }
        if (!shadeStep(w, s, s.waypoint[0], s.waypoint[1], speed * SHADE_WANDER_FACTOR)) s.waypoint = null;
      }
    }
    clampSafe(w, s);
    groundShade(w, s);
  }

  for (const d of w.drifters) {
    if (d.state === "removed") continue;
    const dist = distXZ(d.pos, p.pos);
    if (d.state === "idle" || d.state === "chase") {
      d.state = p.carried >= DRIFTER_CHASE_CARRIED && dist <= DRIFTER_CHASE_DIST && p.respawnWait === 0 ? "chase" : "idle";
    }
    let vx = 0;
    let vz = 0;
    if (d.state === "chase") {
      const [ux, uz] = unit(d.pos[0], d.pos[2], p.pos[0], p.pos[2]);
      const m = Math.min(DRIFTER_SPEED * DT, dist);
      vx = ux * m; vz = uz * m;
    } else if (d.state === "idle") {
      if (!d.waypoint || repick(w, d.id) || dxz(d.pos[0], d.pos[2], d.waypoint[0], d.waypoint[1]) < 0.5) {
        d.waypoint = randomWaypoint(w, d.pos[0], d.pos[2], null);
      }
      const [ux, uz] = unit(d.pos[0], d.pos[2], d.waypoint[0], d.waypoint[1]);
      vx = ux * DRIFTER_IDLE_SPEED * DT; vz = uz * DRIFTER_IDLE_SPEED * DT;
    } else {
      const [ux, uz] = unit(p.pos[0], p.pos[2], d.pos[0], d.pos[2]);
      vx = ux * DRIFTER_SPEED * DT; vz = uz * DRIFTER_SPEED * DT;
    }
    d.pos[0] += vx;
    d.pos[2] += vz;
    d.pos[1] = (w.map.height(d.pos[0], d.pos[2]) ?? 0) + DRIFTER_HEIGHT;
    if (d.state === "flee" && --d.ticks <= 0) { d.state = "removed"; d.stolen = 0; }
  }
}

// 9 ---------------------------------------------------------------- contacts
function dropMotes(w: World, n: number): void {
  const p = w.player;
  for (let i = 0; i < n; i++) {
    let pos: Vec3 | null = null;
    for (let tries = 0; tries < 8 && !pos; tries++) {
      const a = w.rng() * Math.PI * 2;
      const r = DROP_RING_MIN + w.rng() * (DROP_RING_MAX - DROP_RING_MIN);
      const x = p.pos[0] + Math.cos(a) * r;
      const z = p.pos[2] + Math.sin(a) * r;
      const h = w.map.height(x, z);
      if (h !== null && Math.abs(h - p.pos[1]) <= PICK_DY) pos = [x, h, z];
    }
    pos ??= [p.pos[0], w.map.height(p.pos[0], p.pos[2]) ?? p.pos[1], p.pos[2]];
    w.motes.push({ id: `M${w.nextMoteId++}`, pos, kind: "dropped", ttl: DROPPED_TTL });
  }
}

function contacts({ w, emit }: Ctx): void {
  const p = w.player;
  if (p.respawnWait > 0) return;
  const T = w.tuning;
  // Drifters steal first (ids ascending); invulnerability does not protect.
  for (const d of [...w.drifters].sort(cmpId)) {
    if (d.state !== "chase" || distXZ(d.pos, p.pos) > DRIFTER_STEAL_DIST + EPS) continue;
    const amount = Math.min(DRIFTER_STEAL_AMOUNT, p.carried);
    if (amount <= 0) continue;
    p.carried -= amount;
    d.stolen = amount;
    d.state = "flee";
    d.ticks = DRIFTER_FLEE_TICKS;
    emit("drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
  }
  // Shades hit (ids ascending); at most one flame per tick; nothing happens while invulnerable.
  if (p.invuln > 0) return;
  for (const s of [...w.shades].sort(cmpId)) {
    if (s.state === "recoil" || s.state === "stunned" || s.state === "spawning" || s.evict > 0) continue;
    if (distXZ(s.pos, p.pos) > T.shade_hit_radius + EPS || Math.abs(p.pos[1] - s.pos[1]) > PICK_DY + EPS) continue;
    p.flames = Math.max(0, p.flames - 1);
    const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
    p.carried -= dropped;
    dropMotes(w, dropped);
    p.invuln = toTicks(T.invuln_s);
    s.state = "recoil";
    s.recoilTicks = SHADE_RECOIL_TICKS;
    emit("player_hit", { by: "shade", flames: p.flames, dropped });
    break;
  }
}

// 10 --------------------------------------------------------------- spawns
function spawns({ w, emit }: Ctx): void {
  const t = w.simTick;
  const p = w.player;
  if (w.randomMotes && t % MOTE_SPAWN_EVERY === 0 && w.motes.length < MOTE_MAX) {
    const free = w.map.motePoints.filter((pt) => !w.motes.some((m) => dxz(m.pos[0], m.pos[2], pt[0], pt[2]) < 0.01));
    if (free.length) w.motes.push({ id: `M${w.nextMoteId++}`, pos: [...free[Math.floor(w.rng() * free.length)]!] as Vec3, kind: "random", ttl: null });
  }
  if (w.randomShades && t >= SHADE_FIRST_SPAWN_TICK && (t - SHADE_FIRST_SPAWN_TICK) % w.map.shadeEveryTicks === 0) {
    const count = t === SHADE_FIRST_SPAWN_TICK ? SHADE_FIRST_SPAWN_COUNT : 1;
    for (let k = 0; k < count && w.shades.length < w.map.shadeMax; k++) {
      const valid = w.map.shadePoints.filter(
        (pt) =>
          distXZ(pt, p.pos) >= SHADE_SPAWN_MIN_PLAYER_DIST &&
          !w.lanterns.some((l) => l.lit && distXZ(l.pos, pt) <= w.tuning.safe_radius + EPS) &&
          !w.shades.some((s) => distXZ(s.pos, pt) < 0.01),
      );
      if (!valid.length) break; // no valid point: skip this turn
      const pt = valid[Math.floor(w.rng() * valid.length)]!;
      const id = freshShadeId(w);
      w.shades.push({
        id, pos: [pt[0], pt[1] + SHADE_CENTER_UP, pt[2]], state: "spawning", stunTicks: 0, pushTicks: 0, pushDir: [1, 0],
        recoilTicks: 0, evict: 0, evictFrom: null, waypoint: null,
      });
      emit("shade_spawned", { id });
    }
  }
  if (w.randomDrifters && t % DRIFTER_SPAWN_EVERY === 0 && w.drifters.filter((d) => d.state !== "removed").length < DRIFTER_MAX) {
    const pt = w.map.shadePoints[Math.floor(w.rng() * w.map.shadePoints.length)]!;
    w.drifters.push({ id: `D${w.nextDrifterId++}`, pos: [pt[0], pt[1] + DRIFTER_HEIGHT, pt[2]], state: "idle", stolen: 0, ticks: 0, waypoint: null });
  }
}

// 11 --------------------------------------------------------------- win / lose
function checkEnd({ w, emit }: Ctx): void {
  const p = w.player;
  const end = (result: "won" | "lost", reason: EndReason) => {
    w.state = result;
    w.endReason = reason;
    if (result === "won") {
      w.score += w.tuning.score.per_second_left * Math.floor(w.timeLeftTicks / TICK_RATE) + w.tuning.score.per_flame_left * p.flames;
    }
    emit("game_over", { result, reason });
  };
  if (p.flames <= 0) end("lost", "no_flames");
  else if (w.lanterns.every((l) => l.lit)) end("won", "all_lit");
  else if (w.timeLeftTicks <= 0) end("lost", "dawn");
}

// 12 --------------------------------------------------------------- snapshot
export function snapshot(w: World) {
  const p = w.player;
  return {
    type: "snapshot",
    tick: w.tick,
    sim_tick: w.simTick,
    state: w.state,
    night: w.night,
    time_left_s: round3(timeLeftSeconds(w)),
    score: w.score,
    wind: { active: w.wind.active, dir_deg: round3(w.wind.dirDeg) },
    player: {
      pos: r3(p.pos),
      vel: r3(p.vel),
      grounded: p.grounded,
      invuln: p.invuln > 0,
      dash_cd_s: round3(p.dashCd / TICK_RATE),
      pulse_cd_s: round3(p.pulseCd / TICK_RATE),
      charm_s: round3(p.charm / TICK_RATE),
      flames: p.flames,
      carried: p.carried,
    },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: r3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: r3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: r3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : round3(m.ttl / TICK_RATE) })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: r3(d.pos), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: round3(c.respawn / TICK_RATE) })),
  };
}
