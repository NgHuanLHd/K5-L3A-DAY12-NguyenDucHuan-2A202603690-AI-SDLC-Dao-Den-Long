// Pure game types. No DOM / three / node imports allowed in src/core.

export type Vec3 = [number, number, number];
export type GameState = "playing" | "paused" | "won" | "lost";
export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned";
export type DrifterState = "idle" | "chase" | "flee" | "removed";
export const SHADE_STATES: ShadeState[] = ["spawning", "wander", "chase", "recoil", "stunned"];
export const DRIFTER_STATES: DrifterState[] = ["idle", "chase", "flee", "removed"];

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

/** Mirrors game.contract.json "tuning". Values are the single source of truth. */
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
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  /** Internal: simTick at which the lantern was lit (for safe-zone eviction). */
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
  | "resumed";

export interface GameEvent {
  type: "event";
  tick: number;
  name: EventName;
  data: Record<string, unknown>;
}

/** Scenario file (Test Contract D, v1.1). All fields optional. */
export interface Scenario {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ({ pos: Vec3; kind?: "random" | "dropped"; ttl_s?: number | null } | Vec3)[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number; state_ticks_left?: number }[];
  charms?: { id: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number }[];
  time_left_s?: number;
}
