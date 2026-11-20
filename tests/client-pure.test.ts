// AC-208 (settings are validated/persisted safely), AC-211 (standard palette), AC-212 (ambient light).
import { describe, expect, it } from "vitest";
import { ambientIntensity } from "../src/core/lighting.js";
import { C, css } from "../src/client/palette.js";
import { DEFAULT_SETTINGS, parseSettings } from "../src/client/settings.js";

describe("palette = TICKET-02 table", () => {
  it("uses the standard hex values", () => {
    const expected: Record<string, string> = {
      sky: "#0E1430", fog: "#1B2350", grass: "#2F5D50", sand: "#C9B48A", wood: "#6B4A2F", cloudSea: "#12384A",
      lampOn: "#FFB347", lampCore: "#FFE9B0", lampOff: "#5B5F6E", moteCore: "#FFF6C2", moteHalo: "#FFE58A",
      shadeBody: "#120A1A", shadeRim: "#7A3CFF", shadeStunned: "#3A3450", mayShirt: "#E8E2D0", scarfAndCharm: "#C8102E",
      gold: "#F2C14E", drifter: "#8FA3B8", danger: "#FF5A5F", uiText: "#F5F1E6",
    };
    expect(Object.keys(C).sort()).toEqual(Object.keys(expected).sort());
    for (const [k, hex] of Object.entries(expected)) expect(css((C as Record<string, number>)[k]!).toUpperCase()).toBe(hex);
  });
});

describe("settings", () => {
  it("defaults, clamping and corrupt data", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{oops")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ volume: 5, sensitivity: -1 }))).toEqual({ volume: 1, sensitivity: 0.2 });
    expect(parseSettings(JSON.stringify({ volume: 0.25, sensitivity: 2 }))).toEqual({ volume: 0.25, sensitivity: 2 });
    expect(parseSettings(JSON.stringify({ volume: "loud" }))).toEqual(DEFAULT_SETTINGS);
  });
  it("survives a round trip", () => {
    const s = { volume: 0.4, sensitivity: 1.5 };
    expect(parseSettings(JSON.stringify(s))).toEqual(s);
  });
});

describe("ambient light grows with progress: 0.15 + 0.55 × lit/total", () => {
  it("matches the formula", () => {
    expect(ambientIntensity(0, 5)).toBeCloseTo(0.15, 9);
    expect(ambientIntensity(5, 5)).toBeCloseTo(0.7, 9);
    expect(ambientIntensity(3, 6)).toBeCloseTo(0.425, 9);
    expect(ambientIntensity(7, 7)).toBeCloseTo(0.7, 9);
  });
});
