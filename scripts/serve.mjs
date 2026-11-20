#!/usr/bin/env node
// `npm start`: serves dist-web and the local leaderboard API on one port.
//   npm start                                  -> http://localhost:5173
//   npm start -- --export-leaderboard out.json -> writes {"entries": [...]} and exits (TICKET-04 contract run_cmd)
// Needs `npm run build` first (uses dist/).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

if (argv.includes("--export-leaderboard")) {
  const { runHeadless } = await import(pathToFileURL(join(ROOT, "dist/headless/run.js")).href);
  process.exitCode = runHeadless(argv);
} else {
  const { validateEntry, insertEntry } = await import(pathToFileURL(join(ROOT, "dist/core/leaderboard.js")).href);
  const { readLeaderboard, writeLeaderboard } = await import(pathToFileURL(join(ROOT, "dist/headless/leaderboard-store.js")).href);

  const portArg = argv.indexOf("--port");
  const port = portArg >= 0 ? Number(argv[portArg + 1]) : 5173;
  const WEB = join(ROOT, "dist-web");
  const TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  };

  const send = (res, code, body, type = "application/json; charset=utf-8") => {
    res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const readBody = (req) =>
    new Promise((ok, fail) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > 4096) fail(new Error("too large"));
        else chunks.push(c);
      });
      req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
      req.on("error", fail);
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/leaderboard") {
      if (req.method === "GET") return send(res, 200, { entries: readLeaderboard() });
      if (req.method === "POST") {
        let entry;
        try {
          entry = JSON.parse(await readBody(req));
        } catch {
          return send(res, 400, { error: "Dữ liệu điểm không hợp lệ." });
        }
        const err = validateEntry(entry);
        if (err) return send(res, 400, { error: err });
        const list = insertEntry(readLeaderboard(), entry);
        writeLeaderboard(list);
        return send(res, 200, { entries: list });
      }
      return send(res, 405, { error: "method not allowed" });
    }

    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method not allowed" });
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
    let file = join(WEB, rel);
    if (!file.startsWith(WEB)) return send(res, 403, { error: "forbidden" });
    const sendFile = (path, type) => {
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(path.body);
    };
    try {
      const body = await readFile(file);
      return sendFile({ body }, TYPES[extname(file)] ?? "application/octet-stream");
    } catch {
      // SPA-style fallback to the game page.
      try {
        return sendFile({ body: await readFile(join(WEB, "index.html")) }, TYPES[".html"]);
      } catch {
        return send(res, 500, { error: "dist-web missing: run npm run build" });
      }
    }
  });

  server.listen(port, "localhost", () => {
    process.stdout.write(`Đảo Đèn Lồng: http://localhost:${port}\n`);
  });
}
