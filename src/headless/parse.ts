import type { Scenario, Vec3 } from "../core/types.js";

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
  if (night !== 1) throw new UsageError(`only --night 1 is supported`);
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

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);

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
    if (!Number.isInteger(f.tick) || (f.tick as number) < 0) throw new FormatError(`${at}.tick: non-negative integer required`);
    const tick = f.tick as number;
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
    for (const k of ["jump", "interact", "pulse", "dash"] as const) {
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
  if (j.player !== undefined) {
    if (!isObj(j.player)) throw new FormatError("scenario.player: object required");
    const p = j.player;
    s.player = {};
    if (p.pos !== undefined) {
      if (!isVec3(p.pos)) throw new FormatError("scenario.player.pos: [x,y,z] required");
      s.player.pos = p.pos;
    }
    for (const k of ["carried", "flames"] as const) {
      if (p[k] !== undefined) {
        if (!Number.isInteger(p[k]) || (p[k] as number) < 0) throw new FormatError(`scenario.player.${k}: non-negative integer required`);
        s.player[k] = p[k] as number;
      }
    }
  }
  for (const k of ["random_motes", "random_shades"] as const) {
    if (j[k] !== undefined) {
      if (typeof j[k] !== "boolean") throw new FormatError(`scenario.${k}: boolean required`);
      s[k] = j[k] as boolean;
    }
  }
  if (j.motes !== undefined) {
    if (!Array.isArray(j.motes) || !j.motes.every(isVec3)) throw new FormatError("scenario.motes: array of [x,y,z] required");
    s.motes = j.motes as Vec3[];
  }
  if (j.shades !== undefined) {
    if (!Array.isArray(j.shades)) throw new FormatError("scenario.shades: array required");
    s.shades = j.shades.map((sh, i) => {
      if (!isObj(sh) || !isVec3(sh.pos)) throw new FormatError(`scenario.shades[${i}].pos: [x,y,z] required`);
      if (sh.id !== undefined && typeof sh.id !== "string") throw new FormatError(`scenario.shades[${i}].id: string required`);
      return { pos: sh.pos, ...(sh.id !== undefined ? { id: sh.id as string } : {}) };
    });
    const ids = s.shades.flatMap((x) => (x.id ? [x.id] : []));
    if (new Set(ids).size !== ids.length) throw new FormatError("scenario.shades: duplicate id");
  }
  if (j.lanterns !== undefined) {
    if (!Array.isArray(j.lanterns)) throw new FormatError("scenario.lanterns: array required");
    s.lanterns = j.lanterns.map((l, i) => {
      const at = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== "string") throw new FormatError(`${at}.id: string required`);
      const out: NonNullable<Scenario["lanterns"]>[number] = { id: l.id };
      if (l.pos !== undefined) {
        if (!isVec3(l.pos)) throw new FormatError(`${at}.pos: [x,y,z] required`);
        out.pos = l.pos;
      }
      if (l.lit !== undefined) {
        if (typeof l.lit !== "boolean") throw new FormatError(`${at}.lit: boolean required`);
        out.lit = l.lit;
      }
      if (l.deposited !== undefined) {
        if (!Number.isInteger(l.deposited) || (l.deposited as number) < 0) throw new FormatError(`${at}.deposited: non-negative integer required`);
        out.deposited = l.deposited as number;
      }
      return out;
    });
  }
  if (j.time_left_s !== undefined) {
    if (!isNum(j.time_left_s) || j.time_left_s <= 0) throw new FormatError("scenario.time_left_s: positive number required");
    s.time_left_s = j.time_left_s;
  }
  return s;
}
