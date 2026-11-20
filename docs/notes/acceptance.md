# Tiêu chí nghiệm thu

Mỗi dòng: làm A thì thấy B. Cột "Kiểm bằng" trỏ tới test (`tests/`) hoặc scenario (`scenarios/`).

## Phase 1
| ID | Tiêu chí | Kiểm bằng | Trạng thái |
|---|---|---|---|
| AC-01 | Cùng seed + scenario + inputs → output giống hệt | `headless.test.ts`, `rules.test.ts` (đêm đầy đủ 3000 tick); `proof.mjs` chạy mỗi scenario 2 lần | Đạt |
| AC-02 | Dòng đầu là snapshot tick 0, dòng cuối là `end` | `headless.test.ts`; mọi scenario | Đạt |
| AC-03 | Snapshot mỗi N tick, mặc định 10 | `headless.test.ts` | Đạt |
| AC-04 | `move [0,1]` yaw 0 đi +Z đúng `player_speed`; yaw 90 đi +X; dài hơn 1 được chuẩn hóa | `headless.test.ts`, `scenarios/smoke` | Đạt |
| AC-05 | Inputs/scenario sai → mã 2 | `headless.test.ts`, `scenarios/bad-input` | Đạt |
| AC-06 | Hết giờ → `game_over dawn`, `end.state = lost` | `headless.test.ts`, `scenarios/dawn` | Đạt |
| AC-07 | Trong `pickup_radius` (≤) → `mote_picked`, `carried` +1, +`per_mote`; không quá `carry_capacity` | `rules.test.ts` Motes, `scenarios/pickup` | Đạt |
| AC-08 | E trong `interact_radius` → `deposit`; đủ `lantern_cost` → `lantern_lit`, +`per_lantern`; giữ phím chỉ tính 1 lần | `rules.test.ts` Lanterns, `scenarios/light-and-win` | Đạt |
| AC-09 | Bóng Mực đuổi Mây; không vào `safe_radius` của đèn đã thắp | `rules.test.ts` Shades, `scenarios/safe-zone` | Đạt |
| AC-10 | Bóng Mực chạm → `player_hit`, lửa −1, rơi đom đóm, bất tử `invuln_s` | `rules.test.ts` Shades, `scenarios/shade-hit-lose` | Đạt |
| AC-11 | F → Bóng Mực trong `pulse_radius` bị `stunned`, bị đẩy `pulse_push_m`, +`per_stun`; có hồi chiêu; thiếu ánh sáng thì không | `rules.test.ts` Pulse, `scenarios/pulse-stun` | Đạt |
| AC-12 | Thắp đủ 5 đèn → `won all_lit` kèm điểm thưởng; hết lửa → `lost no_flames` | `rules.test.ts`, `scenarios/light-and-win`, `scenarios/shade-hit-lose` | Đạt |
| AC-13 | Scenario setup không phát event, không cộng điểm | `rules.test.ts` Scenario setup | Đạt |
| AC-14 | Bóng Mực tự xuất hiện (`shade_spawned`); `random_shades:false` thì không | `rules.test.ts` | Đạt |
| AC-15 | Mây không ra khỏi đảo | `rules.test.ts` Island boundary | Đạt |
| AC-16 | Game có giao diện: camera 3D, HUD, đèn sáng dần, Bóng Mực tím đen, chơi lại (R) | Ảnh chụp trình duyệt | Đạt một phần: đã xem bằng ảnh; phím E/F khi chơi thật cần người chơi thử (khung xem trước bị ẩn khi kiểm tra) |
