// DOM user interface: menu, night intro, pause, settings, results, dawn and the in-game HUD.
import { TICK_RATE, WIND_EVERY, WIND_WARN_TICKS } from "../core/constants.js";
import type { NightDef } from "../core/maps.js";
import { distXZ, timeLeftSeconds, winNeed, type World } from "../core/world.js";
import type { GameScene } from "./scene.js";
import type { Settings } from "./settings.js";

export type ScreenName = "menu" | "intro" | "pause" | "settings" | "result" | "dawn";

export interface UiHandlers {
  start(): void;
  enterNight(): void;
  resume(): void;
  restartNight(): void;
  toMenu(): void;
  nextNight(): void;
  restartAll(): void;
  settingsChanged(s: Settings): void;
  click(): void;
}

export interface ResultData {
  won: boolean;
  reason: string;
  night: number;
  score: number;
  total: number;
  lit: number;
  lanterns: number;
  flames: number;
  timeLeft: number;
  isLast: boolean;
  /** Lanterns needed at dawn (ceil(win_ratio × total)). */
  need: number;
}

const FLAME_SVG = (on: boolean) =>
  `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 2 3 1-2 1-5 1-8z" fill="${on ? "#FFB347" : "none"}" stroke="${on ? "#FFE9B0" : "#5B5F6E"}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const LANTERN_SVG = (lit: boolean) =>
  `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">${lit ? '<circle cx="28" cy="31" r="22" fill="rgba(255,179,71,0.18)"/>' : '<path d="M6 50c3-4 8-4 11-1 3-5 11-5 14 0 3-3 8-3 11 1z" fill="rgba(155,107,214,0.35)"/>'}
  <path d="M28 4v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="17" y="10" width="22" height="5" rx="2.5" fill="currentColor"/>
  <path d="M15 18h26c2 9 2 17 0 24H15c-2-7-2-15 0-24z" fill="${lit ? "rgba(255,179,71,0.35)" : "rgba(60,40,90,0.5)"}" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
  <rect x="17" y="42" width="22" height="5" rx="2.5" fill="currentColor"/>${lit ? '<path d="M28 21c4 5 5 8 3 11-1 2-5 2-6 0-2-3-1-6 3-11z" fill="#FFF6C2"/>' : ""}</svg>`;

/** Carrying capacity shown on the HUD (ticket-03: 10 + 2 × successful lights, max 20). */
const capacityNow = (w: World) => Math.min(w.tuning.capacity_max, w.tuning.carry_capacity + 2 * w.player.successfulLights);

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export class Ui {
  private readonly $ = (id: string) => document.getElementById(id)!;
  private current: ScreenName | null = null;
  private settingsFrom: ScreenName = "menu";
  private flamesKey = "";
  private lastCountdown = -1;

  constructor(private readonly h: UiHandlers, private settings: Settings) {
    const root = this.$("ui");
    root.innerHTML = `
    <div id="hud" class="hidden">
      <div class="panel p-flames"><span class="plabel">Ngọn lửa</span><div id="hudFlames"></div></div>
      <div class="panel p-time"><span class="plabel">Bình minh sau</span><div id="hudTime">05:00</div><div id="hudGoal"></div></div>
      <div class="panel p-lanterns"><span class="plabel">Đèn lồng</span><div class="lrow"><b id="hudLanterns">0/5</b></div><div id="hudScore">0</div></div>
      <div id="hudCharm" class="hidden"></div>
      <div id="hudMotes" aria-label="Đom đóm"></div>
      <div id="hudCd">
        <div class="cd" id="cdDash"><b>Lướt</b><span>Shift</span></div>
        <div class="cd" id="cdPulse"><b>Tỏa sáng</b><span>F</span></div>
      </div>
      <div id="hudPrompt" class="hidden"></div>
      <div id="hudArrow" class="hidden"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2l8 18-8-5-8 5z" fill="#F2C14E" stroke="#0E1430" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
      <div id="hudBanner" class="hidden"></div>
      <div id="hudFps" class="hidden"></div>
      <div id="hudHelp"><b>WASD</b> đi · <b>Space</b> nhảy · <b>Shift</b> lướt · <b>E</b> nạp đèn · <b>F</b> tỏa sáng · <b>Esc/P</b> tạm dừng<br><b>←/→</b> hoặc kéo chuột xoay camera</div>
    </div>
    <div id="screens">
      <section class="screen" id="menu"><div class="card">
        <div class="icon">${LANTERN_SVG(true)}</div>
        <h1>Đảo Đèn Lồng</h1><p class="sub">Mây, người giữ đèn nhỏ tuổi, thắp lại ánh sáng cho ba hòn đảo giữa biển mây.</p>
        <div class="btns"><button class="primary" data-act="start">Bắt đầu</button><button data-act="settings">Cài đặt</button></div>
        <p class="hint">WASD đi · Space nhảy · Shift lướt · E nạp đèn · F tỏa sáng · Esc tạm dừng</p>
      </div></section>
      <section class="screen" id="intro"><div class="card">
        <p class="eyebrow" id="introNight"></p><h1 id="introName"></h1>
        <p class="quote" id="introQuote"></p><p class="by">Ông Đăng</p>
        <div class="btns"><button class="primary" data-act="enter">Vào Đêm</button></div><p class="hint">hoặc nhấn Enter</p>
      </div></section>
      <section class="screen" id="pause"><div class="card">
        <h1>Tạm dừng</h1><p class="sub">Mọi thứ trên đảo đang đứng yên.</p>
        <div class="btns col"><button class="primary" data-act="resume">Tiếp tục</button><button data-act="restartNight">Chơi lại Đêm</button><button data-act="settings">Cài đặt</button><button data-act="menu">Về menu</button></div>
        <p class="hint">Esc hoặc P để tiếp tục</p>
      </div></section>
      <section class="screen" id="settings"><div class="card">
        <h1>Cài đặt</h1>
        <label class="row"><span>Âm lượng <b id="volVal"></b></span><input id="volume" type="range" min="0" max="100" step="1"></label>
        <label class="row"><span>Độ nhạy chuột <b id="senVal"></b></span><input id="sens" type="range" min="20" max="300" step="5"></label>
        <label class="row"><span>Bảng màu dễ phân biệt</span> <input id="cbMode" type="checkbox"></label>
        <p class="hint">Viền Bóng Mực đổi sang xanh, cảnh báo sang trắng có dấu ⚠. Cài đặt được lưu lại cho lần chơi sau.</p>
        <div class="btns"><button class="primary" data-act="back">Xong</button></div>
      </div></section>
      <section class="screen" id="result"><div class="card">
        <div class="icon" id="resIcon"></div><h1 id="resTitle"></h1><p class="sub" id="resReason"></p>
        <p class="label">Điểm đêm này</p><p class="big" id="resScore">0</p>
        <div class="stats"><div class="stat"><b id="resLit">0/5</b><span>Đèn đã thắp</span></div><div class="stat"><b id="resFlames">0</b><span>Lửa còn lại</span></div><div class="stat"><b id="resTime">0 s</b><span>Thời gian còn</span></div></div>
        <p class="total" id="resTotal"></p>
        <div class="btns" id="resBtns"></div><p class="hint" id="resHint"></p>
      </div></section>
      <section class="screen" id="dawn"><div class="card wide">
        <div class="icon">${LANTERN_SVG(true)}</div><h1>Bình Minh</h1>
        <p class="sub">Ba hòn đảo đã sáng. Biển mây ửng vàng, và Mây có thể nghỉ ngơi rồi.</p>
        <p class="label">Tổng điểm</p><p class="big" id="dawnScore">0</p><div class="nights" id="dawnNights"></div>
        <div class="btns"><button class="primary" data-act="restartAll">Chơi lại từ đầu</button></div>
      </div></section>
    </div>`;

    const flames = this.$("hudMotes");
    for (let i = 0; i < 10; i++) flames.appendChild(document.createElement("i"));

    root.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
      if (!act) return;
      this.h.click();
      switch (act) {
        case "start": this.h.start(); break;
        case "enter": this.h.enterNight(); break;
        case "resume": this.h.resume(); break;
        case "restartNight": this.h.restartNight(); break;
        case "menu": this.h.toMenu(); break;
        case "next": this.h.nextNight(); break;
        case "restartAll": this.h.restartAll(); break;
        case "settings": this.openSettings(); break;
        case "back": this.showScreen(this.settingsFrom); break;
      }
    });
    const vol = this.$("volume") as HTMLInputElement;
    const sen = this.$("sens") as HTMLInputElement;
    const sync = () => {
      this.settings = { volume: Number(vol.value) / 100, sensitivity: Number(sen.value) / 100, colorblind: (this.$("cbMode") as HTMLInputElement).checked };
      this.$("volVal").textContent = `${vol.value}%`;
      this.$("senVal").textContent = `×${(Number(sen.value) / 100).toFixed(2)}`;
      this.h.settingsChanged(this.settings);
    };
    vol.addEventListener("input", sync);
    sen.addEventListener("input", sync);
    (this.$("cbMode") as HTMLInputElement).addEventListener("change", () => {
      sync();
      document.body.classList.toggle("cb", this.settings.colorblind);
    });
    this.applySettings(settings);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    (this.$("volume") as HTMLInputElement).value = String(Math.round(s.volume * 100));
    (this.$("sens") as HTMLInputElement).value = String(Math.round(s.sensitivity * 100));
    this.$("volVal").textContent = `${Math.round(s.volume * 100)}%`;
    this.$("senVal").textContent = `×${s.sensitivity.toFixed(2)}`;
    (this.$("cbMode") as HTMLInputElement).checked = s.colorblind;
    document.body.classList.toggle("cb", s.colorblind);
  }

  get screen(): ScreenName | null {
    return this.current;
  }

  private openSettings(): void {
    this.settingsFrom = this.current === "pause" ? "pause" : "menu";
    this.showScreen("settings");
  }

  showScreen(name: ScreenName | null): void {
    this.current = name;
    for (const el of document.querySelectorAll<HTMLElement>("#screens .screen")) el.classList.toggle("show", el.id === name);
    this.$("hud").classList.toggle("hidden", name === "menu" || name === "dawn" || name === "intro");
    if (name) {
      const first = document.querySelector<HTMLElement>(`#${name} button.primary`);
      first?.focus({ preventScroll: true });
    }
  }

  setIntro(def: NightDef): void {
    this.$("introNight").textContent = `Đêm ${def.night}`;
    this.$("introName").textContent = def.name;
    this.$("introQuote").textContent = `“${def.intro}”`;
  }

  setResult(r: ResultData): void {
    this.$("resIcon").innerHTML = LANTERN_SVG(r.won);
    this.$("resTitle").textContent = r.won ? "Qua một đêm!" : r.reason === "dawn" ? "Trời đã sáng" : "Mây hết lửa";
    this.$("resReason").textContent = r.won
      ? `Mây giữ đảo sáng tới bình minh với ${r.lit}/${r.lanterns} đèn.`
      : r.reason === "dawn" ? `Bình minh đến khi chỉ còn ${r.lit}/${r.lanterns} đèn sáng, cần ${r.need}.` : "Bóng Mực đã dập tắt ngọn lửa cuối cùng của Mây.";
    this.$("resScore").textContent = String(r.won ? r.score : 0);
    this.$("resLit").textContent = `${r.lit}/${r.lanterns}`;
    this.$("resFlames").textContent = String(r.flames);
    this.$("resTime").textContent = `${Math.ceil(r.timeLeft)} s`;
    this.$("resTotal").textContent = r.won ? `Tổng điểm: ${r.total}` : "Đêm thua không được tính điểm.";
    const card = document.querySelector("#result .card")!;
    card.classList.toggle("lost", !r.won);
    this.$("resBtns").innerHTML = r.won
      ? `<button class="primary" data-act="next">${r.isLast ? "Đón Bình Minh" : "Đêm kế tiếp"}</button>`
      : `<button class="primary" data-act="restartNight">Chơi lại Đêm</button><button data-act="menu">Về menu</button>`;
    this.$("resHint").textContent = "hoặc nhấn Enter";
  }

  setDawn(total: number, nights: number[]): void {
    this.$("dawnScore").textContent = String(total);
    this.$("dawnNights").innerHTML = nights.map((s, i) => `<div class="stat"><b>${s}</b><span>Đêm ${i + 1}</span></div>`).join("");
  }

  /** Called every frame while a night is on screen. */
  updateHud(w: World, scene: GameScene, nowMs: number, fps: number, showFps: boolean): ScreenName | null {
    const p = w.player;
    const T = w.tuning;
    const key = `${p.flames}/${T.flames}`;
    if (key !== this.flamesKey) {
      this.flamesKey = key;
      this.$("hudFlames").innerHTML = Array.from({ length: T.flames }, (_, i) => FLAME_SVG(i < p.flames)).join("");
    }
    const left = timeLeftSeconds(w);
    const timeEl = this.$("hudTime");
    timeEl.textContent = mmss(Math.ceil(left));
    const urgent = left <= 30;
    timeEl.classList.toggle("danger", urgent);
    timeEl.classList.toggle("blink", urgent && Math.floor(nowMs / 400) % 2 === 0);

    const lit = w.lanterns.filter((l) => l.lit).length;
    const motes = this.$("hudMotes");
    const cap = capacityNow(w);
    if (motes.children.length !== cap) {
      motes.innerHTML = "";
      for (let i = 0; i < cap; i++) motes.appendChild(document.createElement("i"));
    }
    this.$("hudMotes").setAttribute("data-count", `${p.carried}/${cap}`);
    this.$("hudLanterns").textContent = `${lit}/${w.lanterns.length}`;
    const need = winNeed(w);
    const goal = this.$("hudGoal");
    goal.textContent = `Giữ ≥ ${need}/${w.lanterns.length} đèn sáng tới bình minh · hiện ${lit}`;
    goal.classList.toggle("short", lit < need);
    this.$("hudScore").textContent = `${w.score}`;

    const slots = this.$("hudMotes").children;
    for (let i = 0; i < slots.length; i++) slots[i]!.classList.toggle("on", i < p.carried);

    const setCd = (id: string, ticks: number, total: number, ready: boolean) => {
      const el = this.$(id);
      el.style.setProperty("--p", String(Math.round((ticks / total) * 360)));
      el.classList.toggle("ready", ready && ticks === 0);
      el.classList.toggle("wait", ticks > 0);
    };
    setCd("cdDash", p.dashCd, Math.round(T.dash_cooldown_s * TICK_RATE), true);
    setCd("cdPulse", p.pulseCd, Math.round(T.pulse_cooldown_s * TICK_RATE), p.carried >= T.pulse_cost);
    this.$("cdPulse").classList.toggle("poor", p.carried < T.pulse_cost);

    const charm = this.$("hudCharm");
    charm.classList.toggle("hidden", p.charm <= 0);
    if (p.charm > 0) charm.textContent = `Bùa Gió ${Math.ceil(p.charm / TICK_RATE)} s`;

    // "E — Nạp ánh sáng" when a lantern that still needs light is within reach
    const prompt = this.$("hudPrompt");
    const near = w.lanterns.find((l) => !l.lit && distXZ(l.pos, p.pos) <= T.interact_radius);
    prompt.classList.toggle("hidden", !near);
    if (near) prompt.textContent = `E — Nạp ánh sáng (${near.deposited}/${T.lantern_cost})`;

    // arrow to the nearest unlit lantern when it is off screen
    const arrow = this.$("hudArrow");
    let target: (typeof w.lanterns)[number] | undefined;
    for (const l of w.lanterns) if (!l.lit && (!target || distXZ(l.pos, p.pos) < distXZ(target.pos, p.pos))) target = l;
    let showArrow = false;
    if (target) {
      const sp = scene.project(target.pos);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const onScreen = !sp.behind && sp.x > 40 && sp.x < W - 40 && sp.y > 40 && sp.y < H - 40;
      if (!onScreen) {
        showArrow = true;
        let dx = sp.x - W / 2;
        let dy = sp.y - H / 2;
        if (sp.behind) { dx = -dx; dy = -dy; }
        const ang = Math.atan2(dy, dx);
        const k = Math.min((W / 2 - 60) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - 80) / Math.abs(Math.sin(ang) || 1e-6));
        arrow.style.left = `${W / 2 + Math.cos(ang) * k - 17}px`;
        arrow.style.top = `${H / 2 + Math.sin(ang) * k - 17}px`;
        arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
      }
    }
    arrow.classList.toggle("hidden", !showArrow);

    const banner = this.$("hudBanner");
    const toWind = WIND_EVERY - (w.simTick % WIND_EVERY);
    const windMsg = !w.windEnabled ? "" : w.wind.active ? "Gió mạnh đang thổi!" : toWind <= WIND_WARN_TICKS ? "Gió sắp nổi, bám chắc nhé!" : "";
    banner.textContent = windMsg;
    banner.classList.toggle("hidden", !windMsg);

    const fpsEl = this.$("hudFps");
    fpsEl.classList.toggle("hidden", !showFps);
    if (showFps) fpsEl.textContent = `${Math.round(fps)} FPS`;

    // countdown beep in the last 10 s (returns nothing; main reads this.countdownTick)
    const sec = Math.ceil(left);
    this.countdownTick = w.state === "playing" && sec <= 10 && sec > 0 && sec !== this.lastCountdown;
    if (this.countdownTick) this.lastCountdown = sec;
    if (sec > 10) this.lastCountdown = -1;
    return this.current;
  }

  countdownTick = false;
}
