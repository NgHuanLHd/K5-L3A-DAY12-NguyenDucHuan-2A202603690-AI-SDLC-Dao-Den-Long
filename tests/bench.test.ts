// TICKET-04 benchmark scene: only Shades wander. No pickups, fuel, damage, spawns or end; no chase.
import { describe, expect, it } from "vitest";
import { getNight } from "../src/core/maps.js";
import { createWorld, DEFAULT_INPUT, step } from "../src/core/world.js";
import { loadContract } from "../src/headless/run.js";

const tuning = loadContract().tuning;
const map = getNight(1);
const h0 = map.height(0, 0) ?? 0;
const L1 = map.lanterns[0]!.id;

function benchWorld(bench: boolean) {
  return createWorld(tuning, 42, 1, {
    bench,
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    player: { pos: [0, h0, 0] },
    motes: [[0, h0, 0]],
    lanterns: [{ id: L1, lit: true, fuel: 100, ever_lit: true }],
    shades: [{ id: "S1", pos: [5, map.height(5, 0) ?? h0, 0], state: "wander" }],
  });
}

describe("bench scene", () => {
  it("keeps pickups, fuel, damage, spawns and night end off for 10 s of ticks", () => {
    const w = benchWorld(true);
    const flames = w.player.flames;
    const fuel = w.lanterns[0]!.fuelU;
    for (let i = 0; i < 600; i++) step(w, DEFAULT_INPUT);
    expect(w.motes.length).toBe(1); // mote under the player is not picked up
    expect(w.player.carried).toBe(0);
    expect(w.lanterns[0]!.fuelU).toBe(fuel); // no burn
    expect(w.player.flames).toBe(flames); // no contact damage
    expect(w.state).toBe("playing"); // no end even past the night timer
    expect(w.shades.length).toBe(1); // no new shades spawn
  });

  it("shades keep wandering and never switch to chase near the player", () => {
    const w = benchWorld(true);
    const start = [...w.shades[0]!.pos];
    for (let i = 0; i < 600; i++) step(w, DEFAULT_INPUT);
    expect(w.shades[0]!.state).toBe("wander");
    expect(w.shades[0]!.pos).not.toEqual(start); // they still move
  });

  it("control: the same setup outside bench does chase (rules are not weakened)", () => {
    const w = benchWorld(false);
    let chased = false;
    for (let i = 0; i < 120; i++) {
      step(w, DEFAULT_INPUT);
      if (w.shades[0]!.state === "chase") chased = true;
    }
    expect(chased).toBe(true);
  });
});
