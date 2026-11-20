import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Contract, InputState } from "../core/types.js";
import { createWorld, DEFAULT_INPUT, snapshot, step } from "../core/world.js";
import { FormatError, parseArgs, parseInputs, parseScenario, UsageError, type Frame } from "./parse.js";

/** Repo root: works from src/headless (vitest) and dist/headless (built). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadContract(path = resolve(ROOT, "game.contract.json")): Contract {
  return JSON.parse(readFileSync(path, "utf8")) as Contract;
}

function readText(path: string, what: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new FormatError(`${what}: cannot read ${path} (${(e as Error).message})`);
  }
}

/** Pure simulation: returns JSONL lines. */
export function simulate(
  contract: Contract,
  opts: { seed: number; ticks: number; snapshotEvery: number; scenario?: ReturnType<typeof parseScenario>; frames?: Frame[] },
): string[] {
  const w = createWorld(contract.tuning, opts.seed, opts.scenario);
  const lines: string[] = [JSON.stringify(snapshot(w))];
  const frames = opts.frames ?? [];
  let fi = 0;
  const cur: InputState = { ...DEFAULT_INPUT, move: [0, 0] };

  for (let k = 0; k < opts.ticks; k++) {
    while (fi < frames.length && frames[fi]!.tick <= k) {
      const f = frames[fi++]!;
      if (f.move) cur.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const key of ["jump", "interact", "pulse", "dash"] as const) if (f[key] !== undefined) cur[key] = f[key]!;
    }
    for (const ev of step(w, cur)) lines.push(JSON.stringify(ev));
    if (w.tick % opts.snapshotEvery === 0) lines.push(JSON.stringify(snapshot(w)));
    if (w.state !== "playing") break;
  }
  lines.push(JSON.stringify({ type: "end", ticks: w.tick, state: w.state, score: w.score }));
  return lines;
}

/** CLI entry. Returns exit code: 0 ok, 1 usage/IO error, 2 bad inputs/scenario file. */
export function runHeadless(argv: string[], log: (msg: string) => void = (m) => process.stderr.write(m + "\n")): number {
  try {
    const args = parseArgs(argv);
    const scenario = args.scenario ? parseScenario(readText(args.scenario, "scenario")) : undefined;
    const frames = args.inputs ? parseInputs(readText(args.inputs, "inputs")) : undefined;
    const lines = simulate(loadContract(), {
      seed: args.seed,
      ticks: args.ticks,
      snapshotEvery: args.snapshotEvery,
      scenario,
      frames,
    });
    mkdirSync(dirname(resolve(args.out)), { recursive: true });
    writeFileSync(args.out, lines.join("\n") + "\n", "utf8");
    return 0;
  } catch (e) {
    log(`error: ${(e as Error).message}`);
    if (e instanceof FormatError) return 2;
    if (e instanceof UsageError) return 1;
    return 1;
  }
}
