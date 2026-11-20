# Bằng chứng Phase 1

Tạo lại ở tag `phase-1`:

```bash
npm ci && npm run build && npm test && node scripts/proof.mjs --phase phase-1
```

Kết quả scenario do script tự sinh: [RESULTS.md](RESULTS.md) và các file `*.jsonl` cạnh nó (không sửa tay).

| Yêu cầu PRD-0 | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|
| Headless đúng contract: định dạng, tick, inputs, lỗi (AC-02..06) | `tests/headless.test.ts`; scenarios `smoke`, `dawn`, `bad-input` | `npm test`, RESULTS.md | Đạt |
| Tất định (AC-01) | Chạy 2 lần so byte | RESULTS.md, test "Full night determinism" | Đạt |
| Nhặt đom đóm (AC-07) | `rules.test.ts` Motes; `scenarios/pickup` | RESULTS.md, `pickup.jsonl` | Đạt |
| Nạp ánh sáng thắp đèn (AC-08) | `rules.test.ts` Lanterns; `scenarios/light-and-win` | `light-and-win.jsonl` | Đạt |
| Bóng Mực xuất hiện và đuổi (AC-09, AC-14) | `rules.test.ts` Shades; `scenarios/safe-zone` | `safe-zone.jsonl` | Đạt |
| Bị chạm mất máu (AC-10) | `rules.test.ts`; `scenarios/shade-hit-lose` | `shade-hit-lose.jsonl` | Đạt |
| Tỏa sáng xua Bóng Mực (AC-11) | `rules.test.ts` Pulse; `scenarios/pulse-stun` | `pulse-stun.jsonl` | Đạt |
| Thắng, thua, điểm (AC-12) | `light-and-win` (điểm 309), `shade-hit-lose`, `dawn` | RESULTS.md | Đạt |
| Không ra khỏi đảo (AC-15) | `rules.test.ts` Island boundary | `npm test` | Đạt |
| Camera 3D, HUD, đảo sáng dần, chơi lại (AC-16) | Chạy game, chụp ảnh | `hud.png` (thêm khi chơi thử) | Đạt một phần, xem acceptance.md |
