# Phase 2: kế hoạch và tiêu chí nghiệm thu

Nguồn: [docs/lab/TICKET-02.md](../lab/TICKET-02.md) (Contract **v1.1**, tag `phase-2`). Ticket là nguồn đúng; file này chỉ là cách làm.

## 0. Ưu tiên (60 phút)

Test ẩn (30 điểm) chạy qua headless, và chạy lại cả Phase 1 với số chuẩn. Vì vậy:

| Mức | Việc | Lý do |
|---|---|---|
| **P0** | Contract v1.1 + số chuẩn + thứ tự tick + bản đồ 3 Đêm + luật mới trong `src/core` + headless | Test ẩn chấm phần này |
| **P0** | Sửa test/scenario Phase 1 theo số chuẩn (có lý do), thêm ≥ 1 scenario cho mỗi tính năng mới | DoD |
| **P1** | Client: chuỗi 3 Đêm, tạm dừng, HUD đầy đủ, bảng màu, ánh sáng môi trường | Chất lượng sản phẩm |
| **P2** | Cài đặt lưu được, âm thanh (WebAudio tự tổng hợp), chuột xoay camera, đo FPS | Làm nếu còn giờ; chưa xong thì ghi "chưa đạt" |

Hết giờ thì tag `phase-2` với những gì đã có bằng chứng.

## 1. Thay đổi so với Phase 1 (ghi vào `changes.md` khi làm)

| Luật Phase 1 | Luật Phase 2 | Test/scenario bị ảnh hưởng |
|---|---|---|
| Tuning tự chọn | Số chuẩn (bảng mục 2) | Mọi test đọc `T` tự cập nhật; `expect.json` có số cứng phải sửa |
| +10 điểm khi **nhặt** | +10 mỗi đom đóm **nạp** | `pickup` (điểm 10 → 0), `light-and-win`, test Motes |
| Mây bị giữ trong đảo, `fall_enabled: false` | Rơi khỏi đảo (Y < −10) → mất lửa, hồi sinh | Test "Island boundary" thay bằng test rơi |
| Vận tốc tức thời | Tăng tốc/dừng ≤ 0.1 s (6 tick), điều khiển trên không | Test di chuyển: quãng đường 60 tick = 5.75 m chứ không 6 m |
| Nhảy 6 m/s | 7 m/s, g = −20 | |
| Pulse: XZ, đẩy tức thời, tốn 1 | 3D từ chân + 0.8 m, đẩy 4 m trong 15 tick, tốn 3, hồi 3 s | Test Pulse, `pulse-stun` |
| Bóng Mực: `chase`/`stunned`, đuổi luôn | `spawning/wander/chase/recoil/stunned`, phát hiện 12 m, bỏ đuổi 18 m, recoil 2 m/60 tick sau khi đánh | Test Shades |
| Vùng an toàn 3 m + 0.001 | 6 m, chặn ở mép; bóng bên trong lúc đèn vừa thắp bị đẩy ra ≤ 30 tick, không gây sát thương | `safe-zone` |
| Rơi đom đóm: mất hẳn | Rơi ra vành 1.5–2.5 m, kind `dropped`, TTL 480 tick | Test hit |
| Đom đóm ngẫu nhiên 3–38 m, sinh lại mỗi 3 s | 20 trên 24 điểm cố định, trần 30, sinh tại tick 240k ở điểm trống | |
| Bóng Mực sinh tick 600, mỗi 20 s, tối đa 4 | 2 con tại tick 300, rồi mỗi 8/7/6 s, tối đa 6/8/10, cách Mây ≥ 15 m | Test spawn |
| Thưởng thắng ×1/giây | ×2/giây | `light-and-win` |
| Thứ tự tick của mình (A7) | Thứ tự bắt buộc 12 bước | Toàn bộ `step()` |
| Thắng chỉ xét khi thắp đèn | Xét sau mỗi tick: no_flames > all_lit > dawn | Scenario đặt 5 đèn sáng sẵn → thắng ở tick 1 (A10 cũ bị thay) |

## 2. `game.contract.json` v1.1

| Khóa | Giá trị | Khóa | Giá trị |
|---|---|---|---|
| contract_version | "1.1" | pulse_stun_s | 2.0 (120 tick) |
| player_speed | 6.0 | pulse_push_m | 4.0 |
| carry_capacity | 10 | pulse_cooldown_s | 3.0 |
| lantern_cost | 10 | safe_radius | 6.0 |
| lantern_count_night1 | 5 | shade_speed | 4.0 (Đêm 3 dùng 4.5, hằng số trong map) |
| pickup_radius | 1.0 | shade_hit_radius | 1.0 |
| interact_radius | 2.0 | fall_enabled | true |
| pulse_cost | 3 | score | per_mote 10, per_lantern 100, per_stun 5, per_second_left 2, per_flame_left 50 |
| pulse_radius | 5.0 | dash_speed | 14 |
| night1_duration_s | 300 | dash_duration_s | 0.2 (12 tick) |
| night2_duration_s | 330 | dash_cooldown_s | 1.5 (90 tick) |
| night3_duration_s | 360 | flames / invuln_s / hit_drop_ratio | 3 / 1.5 / 0.5 |

Hằng số không có trong contract nhưng là số chuẩn (để trong `src/core/constants.ts`): nhảy 7, trọng lực 20, tăng tốc 0.1 s, phát hiện 12 / bỏ 18, recoil 2 m/60 tick, đẩy pulse 15 tick, tâm pulse +0.8 m, rơi Y < −10, chờ hồi sinh 60 tick, TTL rơi 480, trần 30, nhịp sinh đom đóm 240, bùa 600/2700 tick và 7.2 m/s, Gió Lạc 7 / 2 m/s, 15 m, 1.2 m, cướp 3, flee 240 / 120 tick, nhịp 1200, tối đa 2, gió 30 s / 5 s / 2 m/s.

## 3. Thiết kế mã

- `src/core/maps.ts` (mới): `NightDef` cho Đêm 1/2/3: `groundHeight(x,z)` (trả `null` nếu là biển mây), `blocked(x,z,footY)` (vách tầng, tháp chuông), điểm xuất phát + hướng mặt, đèn, điểm sinh đom đóm, điểm sinh Bóng Mực, lịch sinh (đầu 300, nhịp, tối đa), bục nhảy, bùa, `windEnabled`, `driftersEnabled`, `shadeSpeed`, thời lượng. Góc θ: `(r·cosθ, y, r·sinθ)` (kiểm tra: tầng 1 ở z > 0 chứa góc 20°–160°).
- `src/core/world.ts`: viết lại `step()` theo đúng 12 bước của ticket, mỗi bước một hàm nhỏ. Mọi bộ đếm tính bằng tick nguyên.
- `src/core/types.ts`: thêm `Drifter`, `Charm`, `Mote.kind/ttl`, trạng thái người chơi (vel, facing, dashTicks, dashCd, pulseCd, invuln, charm, respawnWait, launched).
- `src/headless/parse.ts`, `run.ts`: `--night 1|2|3`; trường scenario/input mới; snapshot mới; `night_start`; tick ≠ sim_tick khi pause.
- Client đọc cùng `NightDef` để vẽ địa hình.

## 4. Nhiệm vụ (làm theo thứ tự, mỗi nhiệm vụ một commit)

| # | Việc | File chính | Xong khi |
|---|---|---|---|
| T1 | Contract v1.1 + hằng số chuẩn + types | `game.contract.json`, `constants.ts`, `types.ts` | `tsc` qua; test A của contract đọc đủ khóa mới |
| T2 | Bản đồ 3 Đêm | `maps.ts`, `tests/maps.test.ts` | Test: độ cao các điểm mẫu (biển, cầu, tầng 1 ở z>0, dốc giữa = 1.5, tháp chặn), 24/24/30 điểm đom đóm, 12/16/16 điểm bóng, vị trí đèn đúng bảng |
| T3 | Di chuyển Mây: tăng tốc, trên không, nhảy, lướt, bục nhảy, gió, vách, rơi + hồi sinh | `world.ts` | Test: 6 tick đạt 6 m/s; lướt 12 tick × 14 m/s = 2.8 m, hồi 90 tick; lướt trên không giữ Y; bục Đêm 2 đáp trong đảo B sau ~84 tick; bục Đêm 3 đáp tầng 2; không đi lên vách; rơi → `player_hit {by:"fall", lost}`, chờ 60 tick, hồi sinh, bất tử 90 |
| T4 | Đom đóm, bùa, đèn, điểm | `world.ts` | Test: nhặt khi dy ≤ 1.5, không khi dy > 1.5; 20 con đầu ở điểm khác nhau; sinh ở tick 240; trần 30; nạp nhiều lần; +10 mỗi con nạp; bùa 600 tick, 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 |
| T5 | Vùng an toàn + Tỏa Sáng | `world.ts` | Test: chặn ở mép 6 m; bóng bên trong khi đèn vừa thắp ra mép ≤ 30 tick, không hit; pulse 3D (bóng ở trên cao > 5 m không trúng), đẩy 4 m trong 15 tick, choáng 120, pulse lại làm mới, < 3 đom đóm không kích hoạt |
| T6 | Bóng Mực: trạng thái, lịch sinh, chạm, recoil, rơi đom đóm ra vành | `world.ts` | Test: tick 300 có 2 `shade_spawned`, state `spawning` rồi `wander`/`chase`; ≥ 15 m; max; chạm XZ ≤ 1, dy ≤ 1.5; 1 lửa/tick; recoil 2 m/60 tick; bất tử thì không gì; rơi floor(c/2) ra vành 1.5–2.5 m |
| T7 | Gió Lạc | `world.ts` | Test: sinh tick 1200 (Đêm 2/3, không Đêm 1); idle → chase (≥ 5 và ≤ 15 m) → cướp min(3, c) → flee 240 tick → removed; pulse lúc chase → flee không cướp; pulse lúc flee có đồ → `drifter_drop`, đom đóm rơi, biến mất sau 120 tick; bất tử không chặn |
| T8 | Pause + thắng/thua + headless v1.1 | `world.ts`, `parse.ts`, `run.ts` | Test: pause → `paused`, tick tăng, sim_tick và time đứng yên, snapshot `state:"paused"`; `resumed`; 5 đèn sáng sẵn → thắng tick 1; hết lửa thắng ưu tiên hơn; `--night 2/3` chạy; snapshot có đủ trường mới; full Đêm 21 600 tick < 30 s |
| T9 | Sửa test + scenario Phase 1, thêm scenario mới | `tests/`, `scenarios/` | `npm test` xanh; mỗi tính năng mới có ≥ 1 scenario: dash, fall, pad-n2, pad-n3, ramp-n3, wind-n3, charm, drifter-steal, drifter-drop, pause, safe-eviction, night2-start, night3-start, perf |
| T10 | Client P1: chuỗi Đêm, menu, tạm dừng, HUD, bảng màu, địa hình 3 Đêm | `src/client/*`, `index.html` | Ảnh chụp từng màn; chơi được từ menu tới Bình Minh |
| T11 | Client P2: cài đặt (localStorage), âm thanh WebAudio, chuột, đo FPS | `src/client/*` | Ảnh/ghi số FPS ở 1280×720; chưa xong ghi "chưa đạt" |
| T12 | Bằng chứng + tài liệu + harness | `docs/`, `AGENTS.md`, skill | `proof.mjs --phase phase-2`; bảng truy vết; retro Phase 2; token |

## 5. Tiêu chí nghiệm thu cho Phần 3 (DoD)

| ID | Tính năng | Tiêu chí (làm A thì thấy B) | Kiểm bằng |
|---|---|---|---|
| AC-201 | Gió Lạc: sinh | Đêm 2/3, `random_drifters` mặc định: tick 1200 có `D1` (state `idle`), tick 2400 có `D2`; không quá 2 con đang sống; Đêm 1 không có | test + scenario `drifter-spawn` |
| AC-202 | Gió Lạc: đuổi | Mây mang ≥ 5 và cách ≤ 15 m → `chase` cùng tick; mang < 5 hoặc xa hơn → `idle` | test |
| AC-203 | Gió Lạc: cướp | Chạm XZ ≤ 1.2 → `drifter_steal {amount: min(3, c), carried}`, state `flee`, `stolen` = amount; sau 240 tick → `removed`; mỗi con cướp 1 lần; Mây bất tử vẫn bị cướp; không mất lửa | scenario `drifter-steal` |
| AC-204 | Gió Lạc: Tỏa Sáng | Trúng lúc `chase` → `flee`, `stolen` = 0. Trúng lúc `flee` có đồ → `drifter_drop`, đom đóm `dropped` tại chỗ, con đó `removed` sau 120 tick. Vùng an toàn không chặn | scenario `drifter-drop` |
| AC-205 | Bùa Gió | Nhặt (XZ ≤ 1, dy ≤ 1.5) → `charm_picked {charm_id, charm_ticks: 600}`; 600 tick chạy 7.2 m/s; lướt không hồi chiêu nhưng phải nhấn lại, nhấn khi đang lướt bị bỏ; nhặt lại làm mới; bùa `available:false`, xuất hiện lại sau 2700 tick; vị trí đúng mỗi Đêm | scenario `charm` |
| AC-206 | Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → Bình Minh + tổng điểm (tổng các Đêm thắng); thua → chơi lại Đêm đó; lửa hồi đầy đầu mỗi Đêm | ảnh từng màn; headless `--night 1/2/3` + `night_start` |
| AC-207 | Tạm dừng | Esc/P → logic dừng hoàn toàn; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; headless: `paused` / `resumed`, tick tăng, sim_tick + thời gian + hồi chiêu + spawn + TTL đứng yên, snapshot `paused` | scenario `pause` + ảnh |
| AC-208 | Cài đặt | Âm lượng và độ nhạy chuột chỉnh được; tải lại trang vẫn giữ | ảnh trước/sau tải lại |
| AC-209 | Âm thanh | Có nhạc nền và 10 hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s | danh sách sự kiện → âm thanh trong code + kiểm tay |
| AC-210 | HUD | Lửa trên trái; mm:ss trên giữa, đỏ nhấp nháy ≤ 30 s; đèn k/n + điểm trên phải; 10 ô đom đóm dưới giữa; hồi chiêu Lướt + Tỏa Sáng dưới phải; "E — Nạp ánh sáng (x/10)" khi gần đèn; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | ảnh |
| AC-211 | Bảng màu | Các thành phần liệt kê dùng đúng hex (±10%/kênh) từ một file `palette.ts` | đọc code + ảnh |
| AC-212 | Ánh sáng môi trường | Cường độ = 0.15 + 0.55 × sáng/tổng | test hàm thuần |
| AC-213 | Hiệu năng | Headless 21 600 tick ≤ 30 s; game ≥ 30 FPS trung bình ở 1280×720 | test thời gian + số đo kèm cấu hình máy |

## 6. Giả định cho chỗ ticket chưa rõ (hỏi trợ giảng nếu kịp)

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| Q1 | `player.invuln` là gì | Boolean (đang bất tử hay không); số tick còn lại không xuất ra |
| Q2 | Thời điểm `night_start` | Dòng thứ hai, ngay sau snapshot tick 0, `tick: 0` |
| Q3 | Điểm xuất phát Đêm 2, 3 | Đêm 2 (0,0,0) mặt +Z. Đêm 3: (0,0,0) nằm trong tháp chuông nên dùng **(0,0,−30)**, mặt +Z |
| Q4 | Trần 30 tính những gì | Mọi đom đóm đang có (cả `dropped`) |
| Q5 | Trạng thái `spawning` kéo dài bao lâu | Đúng tick sinh ra; tick sau thành `wander` hoặc `chase` |
| Q6 | Bóng Mực `wander` | Đi 2 m/s tới điểm ngẫu nhiên (theo seed) trong đảo của nó |
| Q7 | "Chênh cao" khi chạm | \|Y chân Mây − Y tâm Bóng Mực\| ≤ 1.5; bóng sinh ra có tâm ở mặt đất + 1.0 |
| Q8 | Gió Lạc sau khi `removed` | Vẫn ở mảng `drifters` với state `removed` (không tính vào tối đa 2) |
| Q9 | "Điểm sương" của Gió Lạc | Điểm sinh Bóng Mực của Đêm đó; bay ở độ cao mặt đất + 1.5 |
| Q10 | Lịch gió | Bắt đầu ở sim tick 1800, 3600…, kéo dài 300 tick, hướng theo seed; `wind_enabled` mặc định true ở Đêm 3 |
| Q11 | Sau lướt và khi đang bay từ bục | Hết lướt thì trở lại vận tốc phóng (đang bay) hoặc tốc độ chạy theo hướng |
| Q12 | Đom đóm rơi ra ngoài đảo | Chọn điểm trên vành theo seed, thử tối đa 8 lần tìm chỗ có đất; không có thì đặt tại chân Mây |
| Q13 | Bóng Mực và biển/vách | Không đi vào chỗ không có đất hoặc vách cao hơn; đẩy lùi dừng ở đó |
| Q14 | Scenario `drifters[]`, `charms[]` | `drifters: [{id?, pos, state?, stolen?}]`; `charms: [{id, pos?, available?, respawn_ticks?}]` |
| Q15 | Điểm khi thua | Không thưởng; tổng game chỉ cộng các Đêm thắng (client) |

## 7. Token và model

- Đọc ticket, phân tích, lập kế hoạch: Opus (sai ở đây tốn kém nhất).
- Viết mã và test (T1–T12): **Sonnet**, giao từng nhiệm vụ một, trỏ vào file này và ticket thay vì dán lại.
- Hướng dẫn, tài liệu, định dạng: Haiku nếu cần.
- Chạy `npm test` sau mỗi nhiệm vụ; hook Stop chặn khi test đỏ.

## 8. Kết quả so với kế hoạch (cập nhật cuối Phase 2)

| Nhiệm vụ | Kết quả |
|---|---|
| T1 Contract v1.1 + hằng số + types | Xong |
| T2 Bản đồ 3 Đêm | Xong, `maps.test.ts` 16 test |
| T3 Di chuyển, lướt, bục nhảy, vách, dốc, gió, rơi | Xong, `movement.test.ts` 25 test |
| T4 Đom đóm, bùa, đèn, điểm | Xong, `items.test.ts` 19 test |
| T5 Vùng an toàn + Tỏa Sáng | Xong |
| T6 Bóng Mực: trạng thái, sinh, chạm, recoil | Xong, `enemies.test.ts` 23 test |
| T7 Gió Lạc | Xong, `features.test.ts` 20 test |
| T8 Pause, thắng/thua, headless v1.1 | Xong, `headless.test.ts` |
| T9 Scenario | 23 scenario đạt (mỗi tính năng mới ≥ 1) |
| T10 Client P1 | Xong, có ảnh |
| T11 Client P2 | Cài đặt, âm thanh, chuột, FPS: xong về mã; âm thanh **chưa nghe** |
| T12 Bằng chứng + tài liệu | Xong |

Lệch so với kế hoạch: (1) bản đồ có test độ cao ở nhiều điểm hơn dự kiến; (2) thêm `scenarios/*/expect.json` kiểu `snapshots` và `max_seconds` để kiểm bằng chứng theo đường dẫn; (3) Bóng Mực kẹt vách ở Đêm 3 là lỗi phát hiện thêm, đã sửa.
