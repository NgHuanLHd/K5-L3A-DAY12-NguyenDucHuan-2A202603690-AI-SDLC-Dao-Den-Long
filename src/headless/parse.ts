import { DRIFTER_STATES, SHADE_STATES, type DrifterState, type Scenario, type ShadeState, type Vec3 } from "../core/types.js";

/** Bad inputs/scenario file -> exit code 2 (Test Contract B). */
export class FormatError extends Error {}
/** Bad CLI usage / IO problem -> exit code 1. */
export class UsageError extends Error {}

export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface CliArgs {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  scenario?: string;
  inputs?: string;
  snapshotEvery: number;
}

function intArg(name: string, v: string | undefined, min: number): number {
  if (v === undefined || !/^-?\d+$/.test(v)) throw new UsageError(`--${name} requires an integer`);
  const n = Number(v);
  if (n < min) throw new UsageError(`--${name} must be >= ${min}`);
  return n;
}

export function parseArgs(argv: string[]): CliArgs {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) throw new UsageError(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith("--")) throw new UsageError(`missing value for ${a}`);
    m.set(key, val);
    i++;
  }
  const known = new Set(["seed", "night", "ticks", "out", "scenario", "inputs", "snapshot-every"]);
  for (const k of m.keys()) if (!known.has(k)) throw new UsageError(`unknown option --${k}`);
  const night = intArg("night", m.get("night"), 1);
  if (night > 3) throw new UsageError(`--night must be 1, 2 or 3`);
  const out = m.get("out");
  if (!out) throw new UsageError("--out is required");
  return {
    seed: intArg("seed", m.get("seed"), -2147483648),
    night,
    ticks: intArg("ticks", m.get("ticks"), 0),
    out,
    scenario: m.get("scenario"),
    inputs: m.get("inputs"),
    snapshotEvery: m.has("snapshot-every") ? intArg("snapshot-every", m.get("snapshot-every"), 1) : 10,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isNat = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what}: invalid JSON (${(e as Error).message})`);
  }
}

export function parseInputs(text: string): Frame[] {
  const j = parseJson(text, "inputs");
  if (!isObj(j) || !Array.isArray(j.frames)) throw new FormatError("inputs: expected { frames: [...] }");
  let last = -1;
  return j.frames.map((f, i) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) throw new FormatError(`${at}: expected object`);
    if (!isNat(f.tick)) throw new FormatError(`${at}.tick: non-negative integer required`);
    const tick = f.tick;
    if (tick <= last) throw new FormatError(`${at}.tick: ticks must strictly increase`);
    last = tick;
    const out: Frame = { tick };
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every((c) => isNum(c) && c >= -1 && c <= 1))
        throw new FormatError(`${at}.move: [x, z] with each in [-1, 1] required`);
      out.move = [f.move[0] as number, f.move[1] as number];
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!isNum(f.cam_yaw_deg)) throw new FormatError(`${at}.cam_yaw_deg: number required`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ["jump", "interact", "pulse", "dash", "pause"] as const) {
      if (f[k] !== undefined) {
        if (typeof f[k] !== "boolean") throw new FormatError(`${at}.${k}: boolean required`);
        out[k] = f[k] as boolean;
      }
    }
    return out;
  });
}

export function parseScenario(text: string): Scenario {
  const j = parseJson(text, "scenario");
  if (!isObj(j)) throw new FormatError("scenario: expected object");
  const s: Scenario = {};
  const need = (cond: boolean, msg: string) => {
    if (!cond) throw new FormatError(`scenario.${msg}`);
  };

  if (j.player !== undefined) {
    need(isObj(j.player), "player: object required");
    const p = j.player as Record<string, unknown>;
    s.player = {};
    if (p.pos !== undefined) {
      need(isVec3(p.pos), "player.pos: [x,y,z] required");
      s.player.pos = p.pos as Vec3;
    }
    for (const k of ["carried", "flames", "invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks", "successful_lights"] as const) {
      if (p[k] !== undefined) {
        need(isNat(p[k]), `player.${k}: non-negative integer required`);
        s.player[k] = p[k] as number;
      }
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"] as const) {
    if (j[k] !== undefined) {
      need(typeof j[k] === "boolean", `${k}: boolean required`);
      s[k] = j[k] as boolean;
    }
  }
  if (j.motes !== undefined) {
    need(Array.isArray(j.motes), "motes: array required");
    s.motes = (j.motes as unknown[]).map((m, i) => {
      if (isVec3(m)) return m;
      need(isObj(m) && isVec3(m.pos), `motes[${i}]: [x,y,z] or { pos } required`);
      const o = m as Record<string, unknown>;
      const out: { pos: Vec3; kind?: "random" | "dropped"; ttl_s?: number | null } = { pos: o.pos as Vec3 };
      if (o.kind !== undefined) {
        need(o.kind === "random" || o.kind === "dropped", `motes[${i}].kind: random|dropped`);
        out.kind = o.kind as "random" | "dropped";
      }
      if (o.ttl_s !== undefined && o.ttl_s !== null) {
        need(isNum(o.ttl_s) && o.ttl_s >= 0, `motes[${i}].ttl_s: number >= 0`);
        out.ttl_s = o.ttl_s as number;
      }
      return out;
    });
  }
  if (j.shades !== undefined) {
    need(Array.isArray(j.shades), "shades: array required");
    s.shades = (j.shades as unknown[]).map((sh, i) => {
      need(isObj(sh) && isVec3(sh.pos), `shades[${i}].pos: [x,y,z] required`);
      const o = sh as Record<string, unknown>;
      const out: NonNullable<Scenario["shades"]>[number] = { pos: o.pos as Vec3 };
      if (o.id !== undefined) {
        need(typeof o.id === "string", `shades[${i}].id: string required`);
        out.id = o.id as string;
      }
      if (o.state !== undefined) {
        need(SHADE_STATES.includes(o.state as ShadeState), `shades[${i}].state: ${SHADE_STATES.join("|")}`);
        out.state = o.state as ShadeState;
      }
      if (o.state_ticks_left !== undefined) {
        need(isNat(o.state_ticks_left), `shades[${i}].state_ticks_left: non-negative integer required`);
        out.state_ticks_left = o.state_ticks_left as number;
      }
      if (o.target_lantern_id !== undefined) {
        need(typeof o.target_lantern_id === "string", `shades[${i}].target_lantern_id: string required`);
        out.target_lantern_id = o.target_lantern_id as string;
      }
      return out;
    });
    const ids = s.shades.flatMap((x) => (x.id ? [x.id] : []));
    need(new Set(ids).size === ids.length, "shades: duplicate id");
  }
  if (j.drifters !== undefined) {
    need(Array.isArray(j.drifters), "drifters: array required");
    s.drifters = (j.drifters as unknown[]).map((d, i) => {
      need(isObj(d) && isVec3(d.pos), `drifters[${i}].pos: [x,y,z] required`);
      const o = d as Record<string, unknown>;
      const out: NonNullable<Scenario["drifters"]>[number] = { pos: o.pos as Vec3 };
      if (o.id !== undefined) {
        need(typeof o.id === "string", `drifters[${i}].id: string required`);
        out.id = o.id as string;
      }
      if (o.state !== undefined) {
        need(DRIFTER_STATES.includes(o.state as DrifterState), `drifters[${i}].state: ${DRIFTER_STATES.join("|")}`);
        out.state = o.state as DrifterState;
      }
      for (const k of ["stolen", "state_ticks_left"] as const) {
        if (o[k] !== undefined) {
          need(isNat(o[k]), `drifters[${i}].${k}: non-negative integer required`);
          out[k] = o[k] as number;
        }
      }
      return out;
    });
    const ids = s.drifters.flatMap((x) => (x.id ? [x.id] : []));
    need(new Set(ids).size === ids.length, "drifters: duplicate id");
  }
  if (j.charms !== undefined) {
    need(Array.isArray(j.charms), "charms: array required");
    s.charms = (j.charms as unknown[]).map((c, i) => {
      need(isObj(c) && typeof c.id === "string", `charms[${i}].id: string required`);
      const o = c as Record<string, unknown>;
      const out: NonNullable<Scenario["charms"]>[number] = { id: o.id as string };
      if (o.pos !== undefined) {
        need(isVec3(o.pos), `charms[${i}].pos: [x,y,z] required`);
        out.pos = o.pos as Vec3;
      }
      if (o.available !== undefined) {
        need(typeof o.available === "boolean", `charms[${i}].available: boolean required`);
        out.available = o.available as boolean;
      }
      if (o.respawn_ticks !== undefined) {
        need(isNat(o.respawn_ticks), `charms[${i}].respawn_ticks: non-negative integer required`);
        out.respawn_ticks = o.respawn_ticks as number;
      }
      return out;
    });
  }
  if (j.lanterns !== undefined) {
    need(Array.isArray(j.lanterns), "lanterns: array required");
    s.lanterns = (j.lanterns as unknown[]).map((l, i) => {
      const at = `lanterns[${i}]`;
      need(isObj(l) && typeof l.id === "string", `${at}.id: string required`);
      const o = l as Record<string, unknown>;
      const out: NonNullable<Scenario["lanterns"]>[number] = { id: o.id as string };
      if (o.pos !== undefined) {
        need(isVec3(o.pos), `${at}.pos: [x,y,z] required`);
        out.pos = o.pos as Vec3;
      }
      if (o.lit !== undefined) {
        need(typeof o.lit === "boolean", `${at}.lit: boolean required`);
        out.lit = o.lit as boolean;
      }
      if (o.deposited !== undefined) {
        need(isNat(o.deposited), `${at}.deposited: non-negative integer required`);
        out.deposited = o.deposited as number;
      }
      if (o.fuel !== undefined) {
        need(isNum(o.fuel) && o.fuel >= 0 && o.fuel <= 100, `${at}.fuel: number in [0, 100] required`);
        out.fuel = o.fuel as number;
      }
      if (o.ever_lit !== undefined) {
        need(typeof o.ever_lit === "boolean", `${at}.ever_lit: boolean required`);
        out.ever_lit = o.ever_lit as boolean;
      }
      return out;
    });
  }
  if (j.time_left_s !== undefined) {
    need(isNum(j.time_left_s) && j.time_left_s > 0, "time_left_s: positive number required");
    s.time_left_s = j.time_left_s as number;
  }
  return s;
}
