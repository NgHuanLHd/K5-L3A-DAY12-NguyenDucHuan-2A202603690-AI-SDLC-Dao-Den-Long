// Pure game types. No DOM / three / node imports allowed in src/core.

export type Vec3 = [number, number, number];
export type GameState = "playing" | "paused" | "won" | "lost";
export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned" | "drain";
export type DrifterState = "idle" | "chase" | "flee" | "removed";
export const SHADE_STATES: ShadeState[] = ["spawning", "wander", "chase", "recoil", "stunned", "drain"];
export const DRIFTER_STATES: DrifterState[] = ["idle", "chase", "flee", "removed"];

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_relight: number;
  per_stun: number;
  per_drain_stun: number;
  per_lit_dawn: number;
  per_flame_left: number;
}

/** Mirrors game.contract.json "tuning" (contract v1.2). */
export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  relight_cost: number;
  win_ratio: number;
  drain_per_s: number;
  low_fuel_threshold: number;
  capacity_max: number;
}

export interface Contract {
  contract_version: string;
  team: string;
  build_cmd: string;
  run_cmd: string;
  headless_cmd: string;
  tuning: Tuning;
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface Player {
  pos: Vec3;
  /** [vx, vy, vz] */
  vel: Vec3;
  flames: number;
  carried: number;
  grounded: boolean;
  facing: [number, number];
  /** Ticks left of each effect/cooldown. */
  invuln: number;
  dashTicks: number;
  dashDir: [number, number];
  dashCd: number;
  pulseCd: number;
  charm: number;
  launched: boolean;
  launchVel: [number, number];
  respawnWait: number;
  /** Successful lights this night (relights count). Drives carrying capacity. */
  successfulLights: number;
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  /** Motes deposited toward the next light (unlit lanterns only). */
  deposited: number;
  /** Fuel in units of 1/60 (0 when unlit). */
  fuelU: number;
  everLit: boolean;
  relitCount: number;
  /** Internal: tick at which the lantern was lit or refuelled past the low-fuel line (drives eviction). */
  litAt: number;
}

export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stunTicks: number;
  pushTicks: number;
  pushDir: [number, number];
  recoilTicks: number;
  evict: number;
  evictFrom: string | null;
  waypoint: [number, number] | null;
  /** Lantern being drained while state === "drain". */
  drainLantern: string | null;
  drainTicks: number;
  /** Scenario hook: lantern this shade walks to while wandering. */
  targetLantern: string | null;
}

export interface Mote {
  id: string;
  pos: Vec3;
  kind: "random" | "dropped";
  /** Ticks left; null for random motes. */
  ttl: number | null;
}

export interface Drifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number;
  ticks: number;
  waypoint: [number, number] | null;
}

export interface Charm {
  id: string;
  pos: Vec3;
  available: boolean;
  respawn: number;
}

export interface Wind {
  active: boolean;
  dirDeg: number;
  ticksLeft: number;
}

export type EventName =
  | "mote_picked"
  | "deposit"
  | "lantern_lit"
  | "pulse"
  | "player_hit"
  | "shade_spawned"
  | "game_over"
  | "dash"
  | "charm_picked"
  | "drifter_steal"
  | "drifter_drop"
  | "night_start"
  | "paused"
  | "resumed"
  | "refuel"
  | "lantern_out"
  | "fuel_drain";

export interface GameEvent {
  type: "event";
  tick: number;
  name: EventName;
  data: Record<string, unknown>;
}

/** Scenario file (Test Contract D, v1.2). All fields optional. */
export interface Scenario {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    successful_lights?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ({ pos: Vec3; kind?: "random" | "dropped"; ttl_s?: number | null } | Vec3)[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number; target_lantern_id?: string }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number; state_ticks_left?: number }[];
  charms?: { id: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number; fuel?: number; ever_lit?: boolean }[];
  time_left_s?: number;
}
