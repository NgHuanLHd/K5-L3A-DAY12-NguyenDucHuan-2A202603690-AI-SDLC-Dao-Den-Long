# Giả định

Mỗi dòng: giả định, lý do ngắn, phase. Khi ticket làm rõ hoặc đổi, sửa dòng và ghi vào `changes.md`.

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
