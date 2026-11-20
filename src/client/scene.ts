// 3D rendering only. Game rules live in src/core; this file reads a World and draws it.
import * as THREE from "three";
import { ambientIntensity } from "../core/lighting.js";
import { N3, N3_RAMP_ANGLES, PAD_RADIUS, type NightDef } from "../core/maps.js";
import { TICK_RATE, WIND_EVERY, WIND_WARN_TICKS } from "../core/constants.js";
import type { Vec3 } from "../core/types.js";
import type { World } from "../core/world.js";
import { C } from "./palette.js";

const std = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...o });
const basic = (color: number, o: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const rad = (d: number) => (d * Math.PI) / 180;

interface LanternView { post: THREE.Mesh; lamp: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight; zone: THREE.Mesh; tear: THREE.Mesh; bar: THREE.Mesh; barMat: THREE.MeshBasicMaterial }
interface ShadeView { group: THREE.Group; body: THREE.Mesh; rim: THREE.Mesh }
interface DrifterView { mesh: THREE.Mesh; base: Float32Array; last: THREE.Vector3 }

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly ambient = new THREE.AmbientLight(0xb7b0ff, 0.15);
  /** Moonlight keeps terrain readable; the AmbientLight above follows the ticket's formula exactly. */
  private readonly moon = new THREE.DirectionalLight(0x9fb0ff, 1.15);
  private readonly sky = new THREE.HemisphereLight(0x6e7bd8, 0x1b2350, 0.5);
  private readonly playerLight = new THREE.PointLight(C.lampOn, 2, 12, 1.5);
  private readonly fog = new THREE.FogExp2(C.fog, 0.014);
  private night = new THREE.Group();
  private lanterns: LanternView[] = [];
  private charms = new Map<string, THREE.Group>();
  private motes = new Map<string, THREE.Group>();
  private shades = new Map<string, ShadeView>();
  private drifters = new Map<string, DrifterView>();
  private readonly may = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private ringAge = Infinity;
  private readonly leaves: THREE.Mesh[] = [];
  private readonly moteGeo = new THREE.SphereGeometry(0.14, 10, 8);
  private readonly haloGeo = new THREE.SphereGeometry(0.34, 10, 8);
  private readonly moteMat = basic(C.moteCore);
  private readonly haloMat = basic(C.moteHalo, { transparent: true, opacity: 0.35, depthWrite: false });
  private readonly shadeGeo = new THREE.SphereGeometry(0.8, 18, 14);
  private readonly rimGeo = new THREE.SphereGeometry(0.92, 18, 14);
  private readonly bodyMat = std(C.shadeBody, { emissive: C.shadeRim, emissiveIntensity: 0.18 });
  private readonly bodyStunMat = std(C.shadeStunned, { transparent: true, opacity: 0.8 });
  private readonly rimMat = basic(C.shadeRim, { side: THREE.BackSide, transparent: true, opacity: 0.7 });
  private readonly rimStunMat = basic(C.shadeStunned, { side: THREE.BackSide, transparent: true, opacity: 0.4 });
  /** Colour-blind palette (ticket-03): rim and eyes #00B3FF instead of violet and white. */
  private readonly eyeMat = basic(0xffffff);
  private colorblind = false;
  camYaw = 0;
  private width = 1;
  private height = 1;

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    parent.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(C.sky);
    this.scene.fog = this.fog;
    this.scene.add(this.ambient, this.moon, this.sky, this.playerLight, this.night, this.may);
    this.moon.position.set(-20, 40, -10);

    // Mây: cream shirt, red scarf, conical hat with a small lantern.
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 10), std(C.mayShirt));
    body.position.y = 0.75;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), std(C.scarfAndCharm));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.22;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 18), std(C.sand));
    hat.position.y = 1.7;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), basic(C.lampOn));
    lamp.position.set(0.58, 1.3, 0);
    this.may.add(body, scarf, hat, lamp);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), basic(C.moteHalo, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);

    for (let i = 0; i < 36; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), basic(i % 2 ? C.grass : C.sand, { side: THREE.DoubleSide, transparent: true, opacity: 0 }));
      this.leaves.push(leaf);
      this.scene.add(leaf);
    }
  }

  /** Colour-blind palette switch: Bóng Mực rim and eyes change colour; UI warnings are handled in CSS. */
  setColorBlind(on: boolean): void {
    this.colorblind = on;
    this.eyeMat.color.set(on ? 0x00b3ff : 0xffffff);
    this.rimMat.color.set(on ? 0x00b3ff : C.shadeRim);
    this.rimStunMat.color.set(on ? 0x00b3ff : C.shadeStunned);
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ terrain
  private disc(g: THREE.Group, cx: number, cz: number, r: number, topY: number, thick: number, color: number, beach = true): void {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.86, thick, 72), std(color));
    m.position.set(cx, topY - thick / 2, cz);
    g.add(m);
    if (beach) {
      const sand = new THREE.Mesh(new THREE.RingGeometry(r - 2.6, r, 72), std(C.sand, { side: THREE.DoubleSide }));
      sand.rotation.x = -Math.PI / 2;
      sand.position.set(cx, topY + 0.02, cz);
      g.add(sand);
    }
  }

  loadNight(def: NightDef): void {
    this.scene.remove(this.night);
    this.night = new THREE.Group();
    this.scene.add(this.night);
    const g = this.night;
    // Entities of the previous night live directly in the scene: remove them, not just forget them.
    for (const o of this.motes.values()) this.scene.remove(o);
    for (const v of this.shades.values()) this.scene.remove(v.group);
    for (const v of this.drifters.values()) this.scene.remove(v.mesh);
    this.motes.clear();
    this.shades.clear();
    this.drifters.clear();
    this.charms.clear();
    this.lanterns = [];

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(C.cloudSea, { transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -7;
    g.add(sea);

    if (def.night === 1) this.disc(g, 0, 0, 40, 0, 6, C.grass);
    else if (def.night === 2) {
      this.disc(g, 0, 0, 28, 0, 6, C.grass);
      this.disc(g, 70, 0, 28, 0, 6, C.grass);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), std(C.wood));
      bridge.position.set(35, -0.15, 0);
      g.add(bridge);
      for (let x = 27; x <= 43; x += 1.2) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 4.02), std(0x3d2a1a));
        plank.position.set(x, 0.01, 0);
        g.add(plank);
      }
    } else {
      this.disc(g, 0, 0, N3.R, 0, 8, C.grass);
      // tier 1: half ring (z > 0) at Y 3
      const shape = new THREE.Shape();
      shape.absarc(0, 0, N3.RING_OUT, 0, Math.PI, false);
      shape.lineTo(-N3.RING_IN, 0);
      shape.absarc(0, 0, N3.RING_IN, Math.PI, 0, true);
      shape.closePath();
      const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: N3.TIER1_Y, bevelEnabled: false, curveSegments: 56 }), std(C.grass, { color: 0x3a6e60 }));
      t1.rotation.x = Math.PI / 2; // local y -> world z, extrusion goes down
      t1.position.y = N3.TIER1_Y;
      g.add(t1);
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(N3.TIER2_R, N3.TIER2_R, N3.TIER2_Y, 48), std(0x44806f));
      t2.position.y = N3.TIER2_Y / 2;
      g.add(t2);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(N3.TOWER_R * 0.8, N3.TOWER_R, N3.TOWER_TOP - N3.TIER2_Y, 24), std(C.sand));
      tower.position.y = (N3.TOWER_TOP + N3.TIER2_Y) / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(N3.TOWER_R * 1.2, 2.4, 24), std(C.wood));
      roof.position.y = N3.TOWER_TOP + 1.2;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), std(C.gold, { emissive: C.gold, emissiveIntensity: 0.25 }));
      bell.position.y = N3.TOWER_TOP - 0.9;
      g.add(tower, roof, bell);
      const slope = Math.atan2(N3.TIER1_Y, N3.RAMP_BASE_R - N3.RING_OUT);
      const len = Math.hypot(N3.TIER1_Y, N3.RAMP_BASE_R - N3.RING_OUT);
      for (const deg of N3_RAMP_ANGLES) {
        const grp = new THREE.Group();
        grp.rotation.y = -rad(deg); // local +X -> outward along the ramp angle
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, N3.RAMP_W), std(C.wood));
        ramp.position.set((N3.RAMP_BASE_R + N3.RING_OUT) / 2, N3.TIER1_Y / 2 - 0.12, 0);
        ramp.rotation.z = -slope; // rises toward the centre
        grp.add(ramp);
        g.add(grp);
      }
    }

    // lanterns
    for (const l of def.lanterns) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 3, 10), std(C.wood));
      post.position.set(l.pos[0], l.pos[1] + 1.5, l.pos[2]);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), std(C.lampOff, { emissive: C.lampOn, emissiveIntensity: 0 }));
      lamp.position.set(l.pos[0], l.pos[1] + 3.5, l.pos[2]);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), basic(C.lampCore, { transparent: true, opacity: 0 }));
      core.position.copy(lamp.position);
      const light = new THREE.PointLight(C.lampOn, 0, 20, 1.3);
      light.position.copy(lamp.position);
      const zone = new THREE.Mesh(new THREE.RingGeometry(5.9, 6, 72), basic(C.lampOn, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(l.pos[0], l.pos[1] + 0.04, l.pos[2]);
      // unlit lantern: a torn paper strip on the face (ticket-03 colour-free cue)
      const tear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), basic(0x1a1024));
      tear.position.set(l.pos[0] + 0.1, l.pos[1] + 3.3, l.pos[2] + 0.42);
      tear.rotation.z = 0.35;
      const barMat = basic(C.lampOn);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.14), barMat);
      bar.position.set(l.pos[0], l.pos[1] + 4.6, l.pos[2]);
      g.add(post, lamp, core, light, zone, tear, bar);
      this.lanterns.push({ post, lamp, core, light, zone, tear, bar, barMat });
    }
    // launch pads
    for (const p of def.pads) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(PAD_RADIUS, 32), std(C.gold, { emissive: C.gold, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(p.pos[0], p.pos[1] + 0.04, p.pos[2]);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 12), basic(C.moteCore, { transparent: true, opacity: 0.7 }));
      arrow.position.set(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
      g.add(disc, arrow);
    }
    // charms (talisman: red with gold edge)
    for (const c of def.charms) {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.96, 0.04), std(C.gold, { emissive: C.gold, emissiveIntensity: 0.35 })));
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.07), std(C.scarfAndCharm, { emissive: C.scarfAndCharm, emissiveIntensity: 0.3 }));
      grp.add(red);
      grp.position.set(c.pos[0], c.pos[1] + 1.2, c.pos[2]);
      g.add(grp);
      this.charms.set(c.id, grp);
    }
  }

  // ------------------------------------------------------------ per frame
  triggerPulse(): void {
    this.ringAge = 0;
  }

  update(w: World, frameDt: number, nowMs: number): void {
    const p = w.player;
    this.may.position.set(p.pos[0], p.pos[1], p.pos[2]);
    this.may.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    this.may.visible = !(p.invuln > 0 && p.respawnWait === 0) || Math.floor(nowMs / 90) % 2 === 0;
    this.playerLight.position.set(p.pos[0], p.pos[1] + 1.5, p.pos[2]);
    this.playerLight.intensity = 1.4 + p.carried * 0.25 + (p.charm > 0 ? 1.2 : 0);

    let lit = 0;
    w.lanterns.forEach((l, i) => {
      const v = this.lanterns[i];
      if (!v) return;
      if (l.lit) lit++;
      const fill = l.lit ? 1 : l.deposited / w.tuning.lantern_cost;
      const lamp = v.lamp.material as THREE.MeshStandardMaterial;
      lamp.color.set(l.lit ? C.lampOn : C.lampOff);
      lamp.emissiveIntensity = l.lit ? 1.4 : fill * 0.6;
      (v.core.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.95 : fill * 0.5;
      v.light.intensity = l.lit ? 7 : fill * 2;
      (v.zone.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.4 : 0;
      // unlit lanterns sag 20% and show the torn strip; lit ones show the fuel bar (1 Hz blink under 30)
      v.lamp.scale.y = l.lit ? 1 : 0.8;
      v.tear.visible = !l.lit;
      v.bar.visible = l.lit;
      const fuel = l.fuelU / 60;
      v.bar.scale.x = Math.max(0.02, fuel / 100);
      v.bar.position.x = l.pos[0] - (1.4 * (1 - Math.max(0.02, fuel / 100))) / 2;
      const lowBlink = l.lit && fuel < 30 && Math.floor(nowMs / 500) % 2 === 0;
      v.barMat.color.set(lowBlink ? 0x3a2a14 : C.lampOn);
    });
    this.ambient.intensity = ambientIntensity(lit, w.lanterns.length);
    this.fog.density = 0.016 - 0.007 * (lit / Math.max(1, w.lanterns.length));

    // motes
    const aliveM = new Set(w.motes.map((m) => m.id));
    for (const [id, o] of this.motes) if (!aliveM.has(id)) { this.scene.remove(o); this.motes.delete(id); }
    for (const m of w.motes) {
      let o = this.motes.get(m.id);
      if (!o) {
        o = new THREE.Group();
        o.add(new THREE.Mesh(this.moteGeo, this.moteMat), new THREE.Mesh(this.haloGeo, this.haloMat));
        this.scene.add(o);
        this.motes.set(m.id, o);
      }
      o.position.set(m.pos[0], m.pos[1] + 0.8 + Math.sin(nowMs / 420 + m.pos[0] * 1.7) * 0.15, m.pos[2]);
      o.visible = m.ttl === null || m.ttl > 120 || Math.floor(nowMs / 120) % 2 === 0;
    }

    // shades
    const aliveS = new Set(w.shades.map((s) => s.id));
    for (const [id, v] of this.shades) if (!aliveS.has(id)) { this.scene.remove(v.group); this.shades.delete(id); }
    for (const s of w.shades) {
      let v = this.shades.get(s.id);
      if (!v) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(this.shadeGeo, this.bodyMat);
        const rim = new THREE.Mesh(this.rimGeo, this.rimMat);
        const eyeMat = this.eyeMat;
        for (const x of [-0.28, 0.28]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
          eye.position.set(x, 0.15, 0.7);
          body.add(eye);
        }
        group.add(body, rim);
        this.scene.add(group);
        v = { group, body, rim };
        this.shades.set(s.id, v);
      }
      const stunned = s.state === "stunned";
      v.body.material = stunned ? this.bodyStunMat : this.bodyMat;
      v.rim.material = stunned ? this.rimStunMat : this.rimMat;
      const grow = s.state === "spawning" ? 0.5 : 1;
      v.group.scale.setScalar(grow);
      v.group.position.set(s.pos[0], s.pos[1] + Math.sin(nowMs / 300 + s.pos[2]) * 0.08, s.pos[2]);
      v.group.rotation.y = Math.atan2(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
    }

    // drifters (grey-blue ribbons)
    const aliveD = new Set(w.drifters.filter((d) => d.state !== "removed").map((d) => d.id));
    for (const [id, v] of this.drifters) if (!aliveD.has(id)) { this.scene.remove(v.mesh); this.drifters.delete(id); }
    for (const d of w.drifters) {
      if (d.state === "removed") continue;
      let v = this.drifters.get(d.id);
      if (!v) {
        const geo = new THREE.PlaneGeometry(3, 0.5, 14, 1);
        const mesh = new THREE.Mesh(geo, basic(C.drifter, { side: THREE.DoubleSide, transparent: true, opacity: 0.88 }));
        this.scene.add(mesh);
        v = { mesh, base: Float32Array.from(geo.attributes.position!.array as Float32Array), last: new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]) };
        this.drifters.set(d.id, v);
      }
      const dx = d.pos[0] - v.last.x;
      const dz = d.pos[2] - v.last.z;
      if (Math.hypot(dx, dz) > 1e-4) v.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
      v.last.set(d.pos[0], d.pos[1], d.pos[2]);
      v.mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
      const pos = v.mesh.geometry.attributes.position!;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(nowMs / 160 + v.base[i * 3]! * 2.2) * 0.35);
      pos.needsUpdate = true;
    }

    // charms
    w.charms.forEach((c) => {
      const o = this.charms.get(c.id);
      if (!o) return;
      o.visible = c.available;
      o.rotation.y = nowMs / 700;
      o.position.y = c.pos[1] + 1.2 + Math.sin(nowMs / 500) * 0.12;
    });

    // pulse ring (radius = pulse_radius)
    this.ringAge += frameDt;
    const rm = this.ring.material as THREE.MeshBasicMaterial;
    if (this.ringAge < 0.45) {
      this.ring.scale.setScalar(Math.max(0.01, w.tuning.pulse_radius * (this.ringAge / 0.45)));
      this.ring.position.set(p.pos[0], p.pos[1] + 0.8, p.pos[2]);
      rm.opacity = 0.85 * (1 - this.ringAge / 0.45);
    } else rm.opacity = 0;

    // wind leaves: visible during the 2 s warning and while it blows
    const toWind = WIND_EVERY - (w.simTick % WIND_EVERY);
    const windy = w.windEnabled && (w.wind.active || toWind <= WIND_WARN_TICKS);
    const dirRad = rad(w.wind.active ? w.wind.dirDeg : 0);
    this.leaves.forEach((leaf, i) => {
      const m = leaf.material as THREE.MeshBasicMaterial;
      m.opacity = windy ? 0.9 : 0;
      if (!windy) return;
      const t = nowMs / 1000 + i * 1.37;
      const spread = ((i * 7919) % 100) / 100;
      leaf.position.set(
        p.pos[0] + Math.cos(dirRad) * ((t * 8 + i * 3) % 24 - 12) + Math.sin(dirRad) * (spread * 16 - 8),
        p.pos[1] + 1 + spread * 5 + Math.sin(t * 3) * 0.4,
        p.pos[2] + Math.sin(dirRad) * ((t * 8 + i * 3) % 24 - 12) - Math.cos(dirRad) * (spread * 16 - 8),
      );
      leaf.rotation.set(t * 2, t * 3, t);
    });

    // camera orbit
    const t = rad(this.camYaw);
    this.camera.position.set(p.pos[0] - Math.sin(t) * 9, p.pos[1] + 5.2, p.pos[2] - Math.cos(t) * 9);
    this.camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** World point -> screen pixels; `behind` when the point is behind the camera. */
  project(pos: Vec3): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(pos[0], pos[1] + 3, pos[2]).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, behind: v.z > 1 };
  }

  get ticksPerSecond(): number {
    return TICK_RATE;
  }
}
