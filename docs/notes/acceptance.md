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

## Phase 2 (TICKET-02)

Kế hoạch đầy đủ: [phase-2-plan.md](phase-2-plan.md). Bằng chứng: [docs/proof/phase-2/](../proof/phase-2/README.md).

| ID | Tính năng | Tiêu chí (làm A thì thấy B) | Kiểm bằng | Trạng thái |
|---|---|---|---|---|
| AC-201 | Gió Lạc: sinh | Đêm 2/3: D1 ở tick 1200, D2 ở 2400, tối đa 2 con sống; Đêm 1 không có | `features.test.ts` | Đạt |
| AC-202 | Gió Lạc: đuổi | Mây mang ≥ 5 và cách ≤ 15 m → `chase`; ngược lại `idle` | `features.test.ts` | Đạt |
| AC-203 | Gió Lạc: cướp | Chạm XZ ≤ 1.2 → `drifter_steal`, cướp min(3, mang), `flee` 240 tick rồi `removed`; cướp 1 lần; không mất lửa; bất tử không chặn | `features.test.ts`, `scenarios/drifter-steal` | Đạt |
| AC-204 | Gió Lạc: Tỏa Sáng | Trúng `chase` → `flee` không cướp; trúng `flee` có đồ → `drifter_drop`, đom đóm rơi tại chỗ, biến mất sau 120 tick; vùng an toàn không chặn | `features.test.ts`, `scenarios/drifter-drop` | Đạt |
| AC-205 | Bùa Gió | `charm_picked`; 600 tick, chạy 7.2 m/s, lướt không hồi chiêu nhưng cần nhấn lại, nhấn khi đang lướt bị bỏ; nhặt lại làm mới; xuất hiện lại sau 2700 tick; đúng vị trí mỗi Đêm | `features.test.ts`, `scenarios/charm` | Đạt |
| AC-206 | Chuỗi 3 Đêm | Menu → giới thiệu → chơi → kết quả → Đêm kế → Bình Minh (tổng điểm các Đêm thắng); thua thì chơi lại Đêm đó; lửa đầy mỗi Đêm | Ảnh `docs/proof/phase-2/ui-*.png`; scenario `night2-start`, `night3-start` | Đạt (đã chạy hết chuỗi trên trình duyệt) |
| AC-207 | Tạm dừng | Esc/P dừng logic; headless: `paused`/`resumed`, `tick` tăng, `sim_tick`, thời gian, hồi chiêu, spawn đứng yên, snapshot `paused`; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | `features.test.ts`, `scenarios/pause`, ảnh | Đạt |
| AC-208 | Cài đặt | Âm lượng và độ nhạy chuột chỉnh được và còn sau khi tải lại | `client-pure.test.ts` (kiểm dữ liệu), kiểm tay: đặt 35%/×1.80, tải lại, giữ nguyên | Đạt |
| AC-209 | Âm thanh | Nhạc nền + 10 hiệu ứng (nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s) + tiếng gió báo trước 2 s trước mỗi cơn gió (Đêm 3, cùng với lá bay) | Đọc `audio.ts` + `main.ts`; **chưa nghe thử** (môi trường kiểm tra không có loa) | Chưa kiểm chứng bằng tai |
| AC-210 | HUD | Bố cục đúng ticket: Lửa, đồng hồ mm:ss (đỏ + nhấp nháy ≤ 30 s), đèn k/n + điểm, 10 ô đom đóm, 2 biểu tượng hồi chiêu, nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn chưa sáng | Ảnh `docs/proof/phase-2/ui-*.png` | Đạt (xem ảnh) |
| AC-211 | Bảng màu | Dùng đúng hex chuẩn từ `palette.ts` | `client-pure.test.ts` | Đạt cho giá trị; **chưa đo màu pixel trên ảnh** (ánh sáng và sương làm đổi màu hiển thị) |
| AC-212 | Ánh sáng môi trường | AmbientLight = 0.15 + 0.55 × sáng/tổng | `client-pure.test.ts` | Đạt |
| AC-213 | Hiệu năng | Headless 1 Đêm đầy đủ (21 600 tick) ≤ 30 s; game ≥ 30 FPS ở 1280×720 | `scenarios/perf-night3` (≈ 0.3 s), `headless.test.ts`; số đo FPS trong `docs/proof/phase-2/README.md` | Đạt (đo thời gian vẽ mỗi khung, không phải FPS có vsync) |
| AC-214 | Số liệu chuẩn Phần 1 | Mọi hằng số khớp ticket | `headless.test.ts` (contract), `movement/items/enemies.test.ts` | Đạt |
| AC-215 | Bản đồ chuẩn Phần 2 | 3 bản đồ khớp ticket | `maps.test.ts`, `movement.test.ts` | Đạt |
| AC-216 | Contract v1.1 | Trường tuning/snapshot/scenario/input/event đúng v1.1; trạng thái Bóng Mực đúng tên | `headless.test.ts` | Đạt |
| AC-217 | Regression Phase 1 | Các hành vi Phase 1 còn đúng với số chuẩn (có đổi luật theo ticket) | `changes.md`; mọi scenario Phase 1 được cập nhật | Đạt, kèm các thay đổi đã ghi |

## Phase 3 (TICKET-03, Contract v1.2)

ADR: [adr-001-lantern-fuel.md](adr-001-lantern-fuel.md). Changelog phá vỡ tương thích: [changelog-phase3.md](changelog-phase3.md). Giả định: [assumptions.md](assumptions.md) (mục Phase 3).

| ID | Tiêu chí | Kiểm bằng | Trạng thái |
|---|---|---|---|
| AC-301 | Đèn sáng hao 1 dầu/s; về 0 thì tắt, `deposited` = 0, `lantern_out`, `ever_lit` giữ | `fuel.test.ts`, `p3-lantern-out` | Đạt |
| AC-302 | Châm dầu: min(đang mang, ceil((100−fuel)/10)) đom đóm; đèn đầy không được chọn (xem P2) | `fuel.test.ts` Refuel, `p3-refuel` | Đạt có ghi chú P2 |
| AC-303 | Thắp lại chỉ cần 5 đom đóm, +40; thắp lần đầu 10 đom đóm, +100; `relight` trong sự kiện | `fuel.test.ts`, `p3-relight` | Đạt |
| AC-304 | Bóng Mực wander tới đèn sáng dưới 30 gần nhất; ≤ 2 m thì `drain`, hút 5/s, đèn hao thêm 1/s | `fuel.test.ts` Drain, `p3-drain` | Đạt |
| AC-305 | Rời `drain` theo đúng các điều kiện ticket (chase ≤ 6 m, stunned, wander) | `fuel.test.ts` | Đạt |
| AC-306 | Đèn dưới 30 không còn vùng an toàn; đúng 30 tại tick 0 vẫn có, nhưng 1 tick hao sẽ xuống 29.98 (xem ADR) | `fuel.test.ts` Safe zone | Đạt có ghi chú |
| AC-307 | Châm đèn lên ≥ 30 khi có Bóng Mực trong vùng: đẩy ra mép ≤ 30 tick, không hit | `fuel.test.ts` Refuel | Đạt |
| AC-308 | Không thắng sớm; thắng lúc bình minh nếu sống và đủ `ceil(0.6 × n)` đèn: 3/5, 4/6, 5/7 | `fuel.test.ts` Dawn, `p3-dawn-win`, `p3-night2-dawn` | Đạt |
| AC-309 | Thua: hết lửa ngay (cả tick cuối); hết giờ dưới ngưỡng thì `dawn` | `fuel.test.ts`, `p3-no-flames`, `p3-dawn-lose` | Đạt |
| AC-310 | Sức chứa 10 + 2 × thắp thành công, tối đa 20, đặt lại mỗi Đêm; đèn đặt sẵn không tính | `fuel.test.ts` Capacity, `p3-capacity` | Đạt |
| AC-311 | Điểm: +5 mỗi đom đóm nạp, +100/+40 thắp, +5 (+15 nếu drain) mỗi Bóng Mực bị Tỏa Sáng, bình minh +50+fuel và +50/lửa; không thưởng thời gian | `fuel.test.ts`, `p3-drain-stun`, `p3-dawn-win` | Đạt |
| AC-312 | Thời lượng đêm 240 / 270 / 300 s | `fuel.test.ts`, `night2-start`, `night3-start`, `pause` | Đạt |
| AC-313 | Bảng màu dễ phân biệt: viền/mắt Bóng Mực #00B3FF, cảnh báo trắng có ⚠, đèn tắt xẹp 20% và vết rách, đèn sắp hết dầu nhấp nháy; được lưu | `client-pure.test.ts` (dữ liệu cài đặt); ảnh | Đạt cho cài đặt và đèn; **ảnh chỉ kiểm HUD, chưa kiểm mắt người** |
| AC-314 | Thanh dầu trên đèn sáng, nhấp nháy 1 Hz dưới 30; HUD đang mang/sức chứa | ảnh `ui/` | Đạt một phần: HUD đúng; thanh dầu khó thấy từ xa |
| AC-315 | Snapshot và scenario theo contract v1.2 | `headless.test.ts`, `p3-*` | Đạt |
| AC-316 | Test cũ bị luật mới làm sai được cập nhật hoặc xóa có lý do | [changelog-phase3.md](changelog-phase3.md), `items.test.ts` (ghi chú) | Đạt |
