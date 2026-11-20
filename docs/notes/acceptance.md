# Tiêu chí nghiệm thu

Mỗi dòng: làm A thì thấy B. Cột "Kiểm bằng" trỏ tới test hoặc scenario.

## Phase 1
| ID | Tiêu chí | Kiểm bằng | Trạng thái |
|---|---|---|---|
| AC-01 | Cùng seed + scenario + inputs → output giống hệt | `tests/headless.test.ts` determinism; `proof.mjs` chạy 2 lần | Đạt (khung) |
| AC-02 | Dòng đầu là snapshot tick 0, dòng cuối là `end` | test output shape | Đạt (khung) |
| AC-03 | Snapshot mỗi N tick, mặc định 10 | test snapshots | Đạt (khung) |
| AC-04 | `move [0,1]` yaw 0 đi +Z đúng `player_speed`; yaw 90 đi +X; dài hơn 1 được chuẩn hóa | test inputs model, `scenarios/smoke` | Đạt (khung) |
| AC-05 | Inputs/scenario sai → mã 2 | test errors | Đạt (khung) |
| AC-06 | Hết giờ → `game_over dawn`, `end.state = lost` | test dawn | Đạt (khung) |
| AC-07 | Đứng trong `pickup_radius` của mote → `mote_picked`, `carried` +1, điểm + `per_mote` | | Chưa làm |
| AC-08 | `interact` trong `interact_radius` đèn → `deposit`; đủ `lantern_cost` → `lantern_lit` | | Chưa làm |
| AC-09 | Shade đuổi player, không vào `safe_radius` | | Chưa làm |
| AC-10 | Shade trong `shade_hit_radius`, không bất tử → `player_hit`, flames −1, rơi đom đóm | | Chưa làm |
| AC-11 | `pulse` → shade trong `pulse_radius` bị `stunned`, bị đẩy `pulse_push_m` | | Chưa làm |
| AC-12 | Thắp đủ 5 đèn → `won all_lit`; flames 0 → `lost no_flames` | | Chưa làm |
| AC-13 | Scenario setup không phát event, không cộng điểm | | Chưa làm |
| AC-14 | Game có giao diện: HUD, camera, chơi lại | ảnh/GIF | Chưa làm |
