---
name: verify-client
description: Check the 3D client in the browser pane (screens, HUD, nights, pause) and measure frame cost. Use after changing anything in src/client or index.html, or when asked for UI evidence/screenshots.
---

# verify-client

Rules of the game live in `src/core` and are proven by `npm test` + `run-proof`. This skill is only for what you can **see**.

1. `preview_start` with the project dev-server entry (`dao-den-long-dev` in the parent `.claude/launch.json`), then check `read_console_messages` for errors.
2. The dev build exposes `window.__ddl` (never in the production build):
   - `__ddl.world`, `__ddl.phase`, `__ddl.startNight(n)`
   - `__ddl.advance(n)` runs n simulation steps without waiting for animation frames
   - `__ddl.sync()` redraws once and updates the HUD
3. **The browser pane is often hidden, which throttles `requestAnimationFrame` to ~2 frames/s.** Never trust a state read right after a key press. Set the state you want, call `sync()`, then take the screenshot. For real key paths (Esc pause) wait ~2 s and read again.
4. Add `.screen,.card{animation:none!important}` once, otherwise screenshots catch the fade-in half way.
5. Screens to cover: menu, intro, night 1/2/3 HUD, pause, settings, result (won/lost), dawn.
6. Frame cost at 1280×720 (`resize_window`): for each night call `startNight(n)`, `world.player.flames = 99999`, `advance(2400)`, then time 240 × `{ advance(1); sync(); gl.finish() }`. Record avg and p95 ms, GPU name and `devicePixelRatio`. This is cost per frame, **not** vsync FPS; say so in the proof.
7. Reset the viewport (`resize_window` preset `desktop`) and `preview_stop`.
8. Copy screenshots you use as evidence into `docs/proof/phase-N/ui/` and list them in that phase's README with what each one shows. A screenshot taken after forcing state through `__ddl` must be labelled as such.

Do not claim audio works from reading the code: there are no speakers here. Write "not heard" in the proof.
