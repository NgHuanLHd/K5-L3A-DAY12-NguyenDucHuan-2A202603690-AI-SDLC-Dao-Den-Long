# Bằng chứng Phase 1

Tạo lại: `npm ci && npm run build && npm test && node scripts/proof.mjs --phase phase-1` ở tag `phase-1`.
Kết quả scenario tự sinh: [RESULTS.md](RESULTS.md) (không sửa tay).

| Yêu cầu | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|
| AC-01 tất định | test + proof chạy 2 lần | `npm test`, RESULTS.md | |
| AC-02..06 định dạng, tick, inputs, lỗi | `tests/headless.test.ts` | output `npm test` | |
| AC-07..13 luật game | scenarios | RESULTS.md | |
| AC-14 HUD, camera, chơi lại | ảnh/GIF | `hud.png` | |
