// Shared test helpers. Expected values in tests come from docs/lab/TICKET-02.md and game.contract.json,
// never from copying program output.
import type { Scenario } from "../src/core/types.js";
import { parseInputs } from "../src/headless/parse.js";
import { loadContract, simulate } from "../src/headless/run.js";

export const contract = loadContract();
export const T = contract.tuning;
export type Line = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Quiet scenario: nothing random unless the test asks for it. */
export const QUIET: Scenario = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };

export function sim(
  scenario: Scenario = {},
  frames: unknown[] = [],
  o: { ticks?: number; every?: number; night?: number; seed?: number } = {},
): Line[] {
  return simulate(contract, {
    seed: o.seed ?? 1,
    night: o.night ?? 1,
    ticks: o.ticks ?? 60,
    snapshotEvery: o.every ?? 1,
    scenario: { ...QUIET, ...scenario },
    frames: parseInputs(JSON.stringify({ frames })).length ? parseInputs(JSON.stringify({ frames })) : [],
  }).map((l) => JSON.parse(l));
}

export const events = (lines: Line[], name?: string) => lines.filter((l) => l.type === "event" && (!name || l.name === name));
export const snaps = (lines: Line[]) => lines.filter((l) => l.type === "snapshot");
export const snapAt = (lines: Line[], tick: number): Line => {
  const s = snaps(lines).find((l) => l.tick === tick);
  if (!s) throw new Error(`no snapshot at tick ${tick}`);
  return s;
};
export const lastSnap = (lines: Line[]) => snaps(lines).at(-1)!;
export const endLine = (lines: Line[]) => lines.at(-1)!;
/** Press `key` at frame tick (false -> true), release on the next tick. */
export const press = (key: string, tick = 0) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
export const dxz = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!);
export const near = (a: number, b: number, eps = 2e-3) => Math.abs(a - b) <= eps;
