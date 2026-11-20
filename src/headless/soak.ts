// TICKET-04 soak test: N nights back to back in one process (Night 1 -> 2 -> 3 -> 1 ...).
// Night i uses seed (base + i). Inputs are random but seeded: direction every 30 ticks,
// per tick jump 5%, dash 3%, pulse 2%, interact 10%. Never pause.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRng, type Rng } from "../core/rng.js";
import { createWorld, DEFAULT_INPUT, step } from "../core/world.js";
import type { Contract, InputState } from "../core/types.js";
import { loadContract } from "./run.js";
import v8 from "node:v8";
import vm from "node:vm";

const MB = 1024 * 1024;

export interface SoakResult {
  nights: number;
  crashes: number;
  results: ("won" | "lost" | "crashed")[];
  mem_start_mb: number;
  mem_end_mb: number;
  duration_s: number;
}

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / MB) * 10) / 10;
}

/** Forces a full GC when available (flag set at runtime; no CLI flag needed). */
function collect(): void {
  v8.setFlagsFromString("--expose_gc");
  const gc = vm.runInNewContext("gc") as (() => void) | undefined;
  gc?.();
}

const DIRS: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

/** Plays one night to its end (won/lost) or to the night's standard duration. */
export function playNight(contract: Contract, night: number, seed: number, rng: Rng, onLoaded?: () => void): "won" | "lost" {
  const t = contract.tuning;
  const durS = night === 1 ? t.night1_duration_s : night === 2 ? t.night2_duration_s : t.night3_duration_s;
  const maxTicks = Math.round(durS * 60) + 60;
  const w = createWorld(t, seed, night);
  onLoaded?.();
  let dir: [number, number] = [0, 0];
  for (let k = 0; k < maxTicks; k++) {
    if (k % 30 === 0) dir = DIRS[Math.floor(rng() * DIRS.length)]!;
    const input: InputState = {
      ...DEFAULT_INPUT,
      move: [dir[0], dir[1]],
      jump: rng() < 0.05,
      dash: rng() < 0.03,
      pulse: rng() < 0.02,
      interact: rng() < 0.1,
    };
    step(w, input);
    if (w.state === "won" || w.state === "lost") return w.state;
  }
  return w.state === "won" ? "won" : "lost";
}

export function runSoak(seed: number, nights: number, contract: Contract = loadContract()): SoakResult {
  const started = Date.now();
  let memStart = 0;
  const results: SoakResult["results"] = [];
  let crashes = 0;
  for (let i = 0; i < nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = seed + i;
    try {
      // mem_start: RSS right after the first night has loaded.
      const onLoaded = i === 0 ? () => { memStart = rssMb(); } : undefined;
      results.push(playNight(contract, night, nightSeed, createRng(nightSeed), onLoaded));
    } catch {
      crashes++;
      results.push("crashed");
    }
  }
  collect();
  const memEnd = rssMb();
  return {
    nights,
    crashes,
    results,
    mem_start_mb: memStart,
    mem_end_mb: memEnd,
    duration_s: Math.round(((Date.now() - started) / 1000) * 10) / 10,
  };
}

function parseFlag(argv: string[], name: string, fallback: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1]! : fallback;
}

const self = resolve(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const argv = process.argv.slice(2);
  const seed = Number(parseFlag(argv, "--seed", "7"));
  const nights = Number(parseFlag(argv, "--nights", "10"));
  const out = parseFlag(argv, "--out", "soak.json");
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
    process.stderr.write("error: --seed and --nights must be integers, --nights >= 1\n");
    process.exitCode = 1;
  } else {
    const res = runSoak(seed, nights);
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, JSON.stringify(res, null, 2) + "\n", "utf8");
    process.stdout.write(JSON.stringify(res) + "\n");
    process.exitCode = res.crashes === 0 && res.mem_end_mb <= 1.2 * res.mem_start_mb ? 0 : 1;
  }
}
