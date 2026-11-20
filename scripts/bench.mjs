#!/usr/bin/env node
// TICKET-04 benchmark: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Opens the built game (npm run build first) in an installed Chrome or Edge, at 1280x720, with the fixed bench
// scene (?bench=1). Frame times come from requestAnimationFrame in the page; memory is the working set of the
// browser process tree, sampled from Windows/macOS/Linux process tables. Only Node built-ins are used.
import { spawn, execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { cpus, release, tmpdir, totalmem, type } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const SEED = Number(flag("--seed", "42"));
const DURATION_S = Number(flag("--duration", "30"));
const OUT = resolve(flag("--out", "bench.json"));
const WARMUP_MS = 3000; // matches BENCH_WARMUP_MS in src/client/main.ts
if (!Number.isInteger(SEED) || !(DURATION_S > 0)) {
  console.error("error: --seed must be an integer and --duration > 0");
  process.exit(1);
}

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const browserPath = process.env.BENCH_BROWSER ?? BROWSERS.find((p) => existsSync(p));
if (!browserPath) {
  console.error("error: no Chrome or Edge found. Set BENCH_BROWSER to the executable path.");
  process.exit(1);
}

const freePort = () =>
  new Promise((ok, fail) => {
    const s = createServer();
    s.unref();
    s.on("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });

const log = (msg) => process.stderr.write(`[bench] ${msg}
`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      /* not ready yet */
    }
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Working set (MB) of the browser process tree, found by the profile path in the command line. */
function sampleMemoryMb(profileDir) {
  const script = `
$p = '${profileDir.replace(/'/g, "''")}'
$all = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CommandLine,WorkingSetSize
$queue = New-Object System.Collections.Queue
$all | Where-Object { $_.CommandLine -like ('*' + $p + '*') } | ForEach-Object { $queue.Enqueue($_.ProcessId) }
$seen = @{}
while ($queue.Count -gt 0) {
  $id = $queue.Dequeue()
  if ($seen.ContainsKey($id)) { continue }
  $seen[$id] = 1
  $all | Where-Object { $_.ParentProcessId -eq $id } | ForEach-Object { $queue.Enqueue($_.ProcessId) }
}
$sum = ($all | Where-Object { $seen.ContainsKey($_.ProcessId) } | Measure-Object WorkingSetSize -Sum).Sum
[string]([math]::Round($sum / 1MB, 1))`;
  return new Promise((ok) => {
    if (process.platform !== "win32") {
      // Unix: sum RSS of processes whose command line has the profile path.
      execFile("ps", ["-eo", "rss=,args="], (err, stdout) => {
        if (err) return ok(null);
        let kb = 0;
        for (const line of stdout.split("\n")) if (line.includes(profileDir)) kb += Number(line.trim().split(/\s+/)[0]) || 0;
        ok(Math.round((kb / 1024) * 10) / 10);
      });
      return;
    }
    execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 15000 }, (err, stdout) => {
      if (err) return ok(null);
      const v = Number(stdout.trim());
      ok(Number.isFinite(v) ? v : null);
    });
  });
}

/** Frame metrics exactly as TICKET-04 defines them (dt in ms, one value per frame in the measured window). */
export function frameMetrics(dts) {
  const N = dts.length;
  if (N === 0) throw new Error("no frames measured");
  const sum = dts.reduce((a, b) => a + b, 0);
  const avg_fps = (1000 * N) / sum;
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = [...dts].sort((a, b) => b - a).slice(0, k);
  const p1_low_fps = 1000 / (worst.reduce((a, b) => a + b, 0) / k);
  const asc = [...dts].sort((a, b) => a - b);
  const frame_ms_p95 = asc[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
  const r1 = (v) => Math.round(v * 10) / 10;
  return { frames: N, avg_fps: r1(avg_fps), p1_low_fps: r1(p1_low_fps), frame_ms_p95: r1(frame_ms_p95) };
}

async function main() {
  const startEpochMs = Date.now();
  const contract = JSON.parse(readFileSync(join(ROOT, "game.contract.json"), "utf8"));
  if (!existsSync(join(ROOT, "dist-web", "index.html"))) throw new Error("dist-web missing: run npm run build first");

  log("starting local server");
  const port = await freePort();
  const devtoolsPort = await freePort();
  const profileDir = mkdtempSync(join(tmpdir(), "ddl-bench-"));

  const server = spawn(process.execPath, [join(ROOT, "scripts", "serve.mjs"), "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  await waitFor(() => new Promise((ok) => {
    server.stdout.once("data", (d) => ok(String(d).includes("localhost")));
    setTimeout(() => ok(false), 250);
  }), 15000, "the local server");

  log("launching browser");
  const url = `http://localhost:${port}/?bench=1&seed=${SEED}&duration=${DURATION_S}`;
  const chrome = spawn(browserPath, [
    `--remote-debugging-port=${devtoolsPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--window-size=1280,720", "--window-position=0,0",
    "--disable-gpu-vsync", "--disable-frame-rate-limit",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: "ignore" });

  let ws;
  const cleanup = async () => {
    try { if (ws) ws.close(); } catch { /* ignore */ }
    try { chrome.kill(); } catch { /* ignore */ }
    try { server.kill(); } catch { /* ignore */ }
    await sleep(800);
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* chrome may still hold files */ }
  };

  try {
    const pageWs = await waitFor(async () => {
      const list = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json();
      return list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    }, 30000, "the browser DevTools endpoint");

    ws = new WebSocket(pageWs);
    await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
    let nextId = 1;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    const send = (method, params = {}) => new Promise((ok) => {
      const id = nextId++;
      pending.set(id, ok);
      ws.send(JSON.stringify({ id, method, params }));
    });

    log("page connected; running the bench");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });

    // Memory sampler: runs while the bench is on screen.
    let peak = null;
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        const mb = await sampleMemoryMb(profileDir);
        if (mb !== null && (peak === null || mb > peak)) peak = mb;
        await sleep(1000);
      }
    })();

    const evalJson = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
      return r.result?.result?.value ?? null;
    };
    const deadline = Date.now() + (DURATION_S + 90) * 1000;
    let bench = null;
    while (Date.now() < deadline) {
      const v = await evalJson("JSON.stringify(window.__ddlBench || null)");
      const parsed = v ? JSON.parse(v) : null;
      if (parsed?.done) { bench = parsed; break; }
      await sleep(500);
    }
    sampling = false;
    await sampler;
    if (!bench) throw new Error("the bench did not finish (check the browser window and the console)");

    log(`measured ${bench.dts.length} frames`);
    const m = frameMetrics(bench.dts);
    const result = {
      contract_version: contract.contract_version,
      avg_fps: m.avg_fps,
      p1_low_fps: m.p1_low_fps,
      frame_ms_p95: m.frame_ms_p95,
      frames: m.frames,
      load_ms: Math.round(bench.first_frame_epoch_ms - startEpochMs),
      peak_mem_mb: peak,
      vsync_off: false,
      renderer: bench.renderer,
      os: `${type()} ${release()} · ${cpus()[0]?.model ?? "CPU"} · RAM ${Math.round(totalmem() / 1024 ** 3)} GB · ${basename(browserPath)}`,
    };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
    // Screenshot of the bench scene for the README (same directory as bench.json).
    const shot = await send("Page.captureScreenshot", { format: "png" });
    if (shot.result?.data) writeFileSync(join(dirname(OUT), "bench-scene.png"), Buffer.from(shot.result.data, "base64"));
    console.log(JSON.stringify(result, null, 2));
    const pass = result.avg_fps >= 60 && result.p1_low_fps >= 30 && result.load_ms <= 10000;
    console.log(`threshold (avg_fps>=60, p1_low_fps>=30, load_ms<=10000) on this machine: ${pass ? "PASS" : "FAIL"}`);
  } finally {
    await cleanup();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`error: ${e.message}`);
    process.exitCode = 1;
  });
}
