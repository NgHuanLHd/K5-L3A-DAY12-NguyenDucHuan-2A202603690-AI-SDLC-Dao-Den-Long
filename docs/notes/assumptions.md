# Giả định

Mỗi dòng: giả định, lý do ngắn, phase. Khi ticket làm rõ hoặc đổi, sửa dòng và ghi vào `changes.md`.

> **Phase 2 thay thế phần lớn mục Phase 1 bên dưới** (số tuning, A2, A7, A12–A15…). Phần Phase 1 được giữ nguyên làm lịch sử ở tag `phase-1`; luật hiện hành nằm ở mục "Phase 2" ngay đây và trong `docs/lab/TICKET-02.md`.

## Phase 2 (giả định cho chỗ ticket chưa rõ)

Các số và luật đã được ticket quy định thì không ghi lại ở đây. Chỉ ghi chỗ ticket **không nói**. Mọi mục là giả định của tôi, chưa hỏi trợ giảng; nếu trợ giảng trả lời khác thì lời trợ giảng đúng.

| # | Chỗ chưa rõ | Giả định đang dùng |
|---|---|---|
| Q1 | `player.invuln` | Boolean: còn bất tử hay không |
| Q2 | Thời điểm `night_start` | Dòng ngay sau snapshot tick 0, `tick: 0` |
| Q3 | Điểm xuất phát Đêm 3 ((0,0,0) nằm trong tháp chuông) | **(0,0,−30)**, tầng 0, quay mặt +Z. Đêm 1 và 2 xuất phát (0,0,0) |
| Q4 | Trần 30 đom đóm | Tính mọi đom đóm đang có, kể cả `dropped`; Đêm 1 và 2 chỉ có 24 điểm nên không bao giờ quá 24 đom đóm ngẫu nhiên |
| Q5 | `spawning` kéo dài bao lâu | Đúng tick sinh ra; tick sau thành `chase`/`wander` |
| Q6 | `wander` | Đi tới điểm ngẫu nhiên cùng tầng trên đảo gần nhất, tốc độ = 0.5 × tốc độ đuổi; đổi điểm mỗi 120 tick |
| Q7 | Chênh cao khi chạm | \|Y chân Mây − Y tâm Bóng Mực\| ≤ 1.5; tâm bóng = mặt đất + 1.0 |
| Q8 | Gió Lạc sau `removed` | Vẫn nằm trong mảng `drifters` với `state: removed`, không tính vào tối đa 2 |
| Q9 | "Điểm sương" của Gió Lạc | Điểm sinh Bóng Mực của Đêm đó; bay ở độ cao mặt đất + 1.5 |
| Q10 | Lịch gió | Bắt đầu ở `sim_tick` 1800k, kéo dài 300 tick, hướng ngẫu nhiên theo seed (độ, 3 chữ số); mặc định bật ở Đêm 3 |
| Q11 | Sau lướt | Về vận tốc trước đó: vận tốc phóng nếu đang bay, hoặc tốc độ chạy theo phím |
| Q12 | Đom đóm rơi ra chỗ không có đất | Thử 8 lần chọn điểm trên vành có đất cùng độ cao; không được thì đặt tại chân Mây |
| Q13 | Bóng Mực và biển/vách | Không đi vào biển; không leo vách cao hơn chân + 0.3 m; đẩy lùi dừng tại đó |
| Q14 | Scenario `drifters[]`, `charms[]` | `drifters: [{id?, pos, state?, stolen?, state_ticks_left?}]`; `charms: [{id, pos?, available?, respawn_ticks?}]`; `motes[]` nhận cả `[x,y,z]` và `{pos, kind?, ttl_s?}` |
| Q15 | Điểm khi thua | Không thưởng cuối trận; tổng điểm game chỉ cộng các Đêm thắng |
| Q16 | Scenario `shades[]` không ghi `state` | `wander`, rồi tick đầu tự thành `chase` nếu trong 12 m |
| Q17 | `state_ticks_left = N` | Còn đúng N tick: vẫn `stunned` ở snapshot tick N−1 và hết ở tick N |
| Q18 | Hạ cánh từ bục nhảy | Giữ vận tốc ngang, giảm dần về 0 trong ≤ 0.1 s (không dừng đột ngột) |
| Q19 | Phím di chuyển khi Mây vừa rơi chờ hồi sinh | Bỏ qua mọi hành động trong 60 tick chờ |
| Q20 | Tỏa Sáng không trúng ai | Vẫn tốn 3 đom đóm, phát `pulse` với `stunned_ids: []` |
| Q21 | `pulse` event và Gió Lạc | `stunned_ids` chỉ gồm Bóng Mực; Gió Lạc bị đẩy xa/thả đồ qua `drifter_*` |
| Q22 | Thời điểm hiệu lực bùa | Còn 600 tick tính cả tick nhặt; `charm_s` giảm từ tick kế tiếp |

Các giả định Q1–Q3 và Q10 ảnh hưởng nhiều nhất tới test ẩn.

## Phase 1

### Số tuning (khớp `game.contract.json`)
| Tham số | Giá trị | Lý do |
|---|---|---|
| player_speed | 5.0 m/s | Đi hết bán kính đèn (25 m) trong 5 s |
| carry_capacity | 5 | Đủ thắp 1 đèn và còn dư để tỏa sáng |
| lantern_cost | 3 | 5 đèn × 3 = 15 đom đóm, ít hơn 20 đom đóm trên đảo |
| lantern_count_night1 | 5 | Contract |
| pickup_radius | 1.0 m | |
| interact_radius | 2.0 m | |
| pulse_cost | 1 | Tốn 1 đom đóm đang mang |
| pulse_radius | 6.0 m | |
| night1_duration_s | 180 | |
| flames | 3 | Máu |
| invuln_s | 1.5 | |
| hit_drop_ratio | 0.5 | Rơi floor(carried × 0.5) |
| pulse_stun_s | 2.0 | |
| pulse_push_m | 3.0 | |
| pulse_cooldown_s | 1.0 | |
| safe_radius | 3.0 | Chỉ quanh đèn đã thắp |
| shade_speed | 3.0 m/s | Chậm hơn Mây |
| shade_hit_radius | 0.8 m | |
| fall_enabled | false | Mây bị giữ trong đảo |
| score.* | 10 / 100 / 5 / 1 / 50 | mote / lantern / stun / giây còn lại / lửa còn lại |

### Luật (chỗ PRD-0 chưa quy định)
- A1. Đảo tròn bán kính 40 m, tâm (0,0,0). Đèn L1…L5 trên vòng 25 m, L1 tại (0,0,25), cách đều 72°.
- A2. Đom đóm: 20 con ngẫu nhiên (theo seed) cách tâm 3–38 m. Mỗi 3 s sinh lại 1 con nếu ít hơn 20. Không có event cho việc sinh đom đóm (contract không có).
- A3. Hết giờ (`time_left_s` về 0) → `game_over {lost, dawn}`.
- A4. Nhảy: vận tốc 6 m/s, trọng lực 20 m/s². Chỉ đổi Y, không ảnh hưởng khoảng cách XZ.
- A5. Mã thoát: 0 ok; 2 inputs/scenario sai định dạng hoặc không đọc được; 1 sai tham số CLI.
- A6. Frame có `tick` vượt `--ticks` bị bỏ qua.
- A7. Thứ tự trong một tick: di chuyển/nhảy → nhặt → nạp đèn → tỏa sáng → Bóng Mực di chuyển → chạm → sinh thêm → hết giờ. Game kết thúc thì bỏ qua phần còn lại.
- A8. Nhặt: mọi đom đóm trong `pickup_radius` (≤) được nhặt cùng tick theo thứ tự id, đến khi đầy `carry_capacity`; đầy thì đom đóm ở lại.
- A9. Nạp đèn (E, cạnh false→true): chọn đèn **chưa thắp** gần nhất trong `interact_radius`; nạp `min(carried, lantern_cost − deposited)`. Đủ `lantern_cost` thì thắp. Không mang gì thì không có event.
- A10. Thắng khi đèn cuối cùng được thắp (`all_lit`). Scenario đặt sẵn cả 5 đèn `lit: true` không tự thắng.
- A11. Điểm thưởng cuối trận chỉ cộng khi thắng: `per_second_left × floor(time_left)` + `per_flame_left × flames`.
- A12. Tỏa sáng (F): cần `carried ≥ pulse_cost` và hết hồi chiêu; tốn `pulse_cost`. Mọi Bóng Mực trong `pulse_radius` (≤), kể cả đang choáng, bị choáng lại `pulse_stun_s` và đẩy ra xa `pulse_push_m` theo hướng từ Mây (trùng vị trí thì đẩy +X). `per_stun` cho mỗi con. Tỏa sáng khi không có con nào vẫn tốn ánh sáng và phát `pulse` với `stunned_ids: []`.
- A13. Bóng Mực: trạng thái `chase` hoặc `stunned`. Đuổi thẳng về Mây với `shade_speed`. Không vào vùng `safe_radius` quanh **đèn đã thắp** (bị đẩy ra mép vùng + 0.001 m). Đèn chưa thắp không bảo vệ.
- A14. Sinh Bóng Mực (khi `random_shades` không phải false): con đầu ở tick 600 (10 s), sau đó mỗi 20 s, tối đa 4 con, ở vòng 37 m, cao Y = 1, tránh vùng an toàn. Phát `shade_spawned`. Id `S1, S2…`, bỏ qua id scenario đã dùng.
- A15. Bị chạm: Bóng Mực không choáng trong `shade_hit_radius` (≤), Mây không bất tử → mất 1 lửa, rơi `floor(carried × hit_drop_ratio)` đom đóm (mất hẳn), bất tử `invuln_s`. Mỗi tick tối đa 1 lần chạm. Hết lửa → `lost, no_flames`.
- A16. Thời gian tính bằng tick nguyên: `round(giây × 60)` cho bất tử, hồi chiêu, choáng.
- A17. Không có va chạm với cột đèn hay giữa các vật thể: contract đo mọi khoảng cách theo điểm trên XZ, va chạm sẽ làm lệch vị trí mà test mong đợi.
- A18. `dash` được chấp nhận trong inputs nhưng không có tác dụng.

## Phase 3 (TICKET-03): giả định cho chỗ ticket chưa rõ

Các số và luật đã được ticket quy định thì không ghi lại ở đây. Quyết định kiến trúc nằm trong [ADR-001](adr-001-lantern-fuel.md).

| # | Chỗ chưa rõ | Giả định đang dùng |
|---|---|---|
| P1 | Bóng Mực lang thang khi không có đèn yếu | Về **đèn tắt gần nhất** (ticket: "như trước"). Phase 2 thực tế đi tới điểm ngẫu nhiên; đổi sang đèn tắt là thay đổi hành vi, ghi trong changelog |
| P2 | Đèn đầy dầu "không được chọn" | Thứ tự tick hao dầu trước tương tác nên đèn 100 còn 99.98 và vẫn nhận 1 đom đóm. Giữ đúng thứ tự ticket; hỏi trợ giảng |
| P3 | Thắp lại trong scenario | `ever_lit` mặc định bằng `lit` (đèn đặt sáng sẵn coi như đã từng sáng) |
| P4 | Điểm Tỏa Sáng vào Bóng Mực đang drain | +15 **thay** cho +5 (không cộng cả hai) |
| P5 | Ngưỡng thắng khi tổng đèn không chia hết | `ceil(0.6 × n)` tính bằng `Math.ceil(0.6n − 1e-9)` để tránh sai số số thực |
| P6 | `fuel_drain` ghi "mỗi 60 tick khi đang hút" | Đếm từ lúc bắt đầu drain, mỗi con một lần; ghi ở tick 61, 121, … |
| P7 | Shade drain và Mây trong 6 m | Mây vào 6 m thì chuyển `chase` ngay (ticket) dù đang hút; nếu chạm thì bị hit như bình thường |
| P8 | Shade bị hit khi đang drain | Có thể bị hit (drain không bất tử); hit thì chuyển `recoil` và bỏ drain |
| P9 | Đèn tắt khi đang bị hút | Bóng Mực đang drain đèn đó chuyển `wander` ở tick kế tiếp (bước 8) |
| P10 | Thắng/thua tại tick bình minh có hết lửa | `no_flames` thắng thứ tự (ticket: "hết Ngọn Lửa luôn thua no_flames trước") |
| P11 | Điểm thắng bình minh | `per_lit_dawn` (50) + floor(fuel) cho mỗi đèn sáng; `per_flame_left` (50) mỗi lửa còn lại. Đèn tắt không được tính |
| P12 | Scenario `drain` không có `target_lantern_id` | Bóng Mực ở trạng thái drain không có đèn là `wander` ở tick đầu |
