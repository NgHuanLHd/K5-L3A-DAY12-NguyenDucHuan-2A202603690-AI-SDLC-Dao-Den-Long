// Standard palette (TICKET-02 Part 3). Every listed component uses exactly these hex values.
export const C = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lampOn: 0xffb347,
  lampCore: 0xffe9b0,
  lampOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStunned: 0x3a3450,
  mayShirt: 0xe8e2d0,
  scarfAndCharm: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
  danger: 0xff5a5f,
  uiText: 0xf5f1e6,
} as const;

export const css = (n: number): string => "#" + n.toString(16).padStart(6, "0");
