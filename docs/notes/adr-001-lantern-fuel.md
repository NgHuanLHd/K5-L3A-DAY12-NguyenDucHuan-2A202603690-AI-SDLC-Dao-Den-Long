# ADR-001: Đèn có dầu, mục tiêu là giữ đảo sáng tới bình minh

- Trạng thái: chấp nhận (Phase 3, TICKET-03)
- Ngày: 2026-11-20

## Bối cảnh
Phase 2 kết thúc Đêm ngay khi tất cả đèn sáng, và đèn đã sáng không nhận thêm đom đóm. Playtest cho thấy người chơi giỏi thắp hết trong khoảng 2 phút, nên cuối đêm thiếu căng thẳng. Nhà thiết kế (ticket) yêu cầu đèn có thể tắt lại, mục tiêu đổi thành "giữ đảo sáng tới bình minh".

## Quyết định

1. **Mô hình trạng thái đèn.** Mỗi đèn có `lit`, `fuelU` (số nguyên, đơn vị 1/60 dầu), `deposited` (tiến độ khi chưa sáng), `everLit` và `relitCount`.
   - Đèn sáng hao 1 đơn vị mỗi tick (1.0 dầu/s); mỗi Bóng Mực đang hút trừ thêm 5 đơn vị mỗi tick.
   - Dầu về 0 thì đèn tắt, `deposited` về 0, `everLit` giữ nguyên. Điều này tách "đã từng sáng" (chi phí thắp lại 5) khỏi "đang sáng".
2. **Số nguyên thay vì số thực.** Dầu lưu theo đơn vị 1/60 để một tick hao đúng 1 đơn vị và không tích lũy sai số. Chỉ làm tròn một chữ số khi xuất ra.
3. **Thứ tự tick.** Hao dầu và hút dầu nằm ở bước 2 (trước tương tác), đèn tắt ngay sau đó. Hệ quả: một đèn "đầy" 100 đã xuống 99.98 khi tới lượt tương tác, nên vẫn nhận được 1 đom đóm. Đây là hệ quả đúng của thứ tự ticket, không phải lỗi; xem mục "Hệ quả" bên dưới.
4. **Thắng/thua.** Không còn thắng sớm. Tại mỗi tick: hết lửa thì thua `no_flames` ngay (kể cả tick bình minh); chỉ khi hết giờ mới xét `dawn_survived` nếu số đèn sáng ≥ `ceil(0.6 × tổng)`, ngược lại thua `dawn`.
5. **Vùng an toàn gắn với dầu.** Đèn sáng có dầu ≥ 30 mới có vùng 6 m. Dưới 30 thì Bóng Mực được vào. Khi châm lên trên 30 thì các Bóng Mực trong vùng bị đẩy ra mép trong tối đa 30 tick, không gây sát thương.
6. **Trạng thái hút (`drain`).** Bóng Mực ở `wander` đi tới đèn sáng dưới 30 dầu gần nhất. Khi cách ≤ 2 m thì chuyển `drain`, đứng yên và hút. Rời `drain` khi đèn tắt, dầu lên ≥ 30, cách > 2 m (sang `wander`), hoặc Mây vào 6 m (sang `chase`), hoặc bị Tỏa Sáng (sang `stunned`).
7. **Sức chứa** = 10 + 2 × số lần thắp thành công (kể cả thắp lại), tối đa 20; đặt lại mỗi Đêm. Đèn đặt sẵn trong scenario không tính.

## Lý do
- Giữ mục tiêu "đảo sáng tới bình minh" biến cuối đêm thành việc quản lý dầu: châm đèn nào, khi nào, và bảo vệ đèn khỏi Bóng Mực hút.
- Số nguyên giữ kết quả tất định giữa các lần chạy và giữa headless với client.
- Tách `everLit` khỏi `lit` cho phép đặt chi phí thắp lại (5) và điểm thắp lại (40) mà không cần đoán lịch sử từ tiến độ.

## Phương án đã bỏ
- **Dầu dạng số thực:** dễ sai số tích lũy; thứ tự làm tròn khác nhau giữa headless và client sẽ làm mất tất định.
- **Thắng khi thắp đủ rồi giữ:** ticket đã loại bỏ, vì nó chính là vấn đề playtest.
- **Đèn đầy không bị chọn bằng cách kiểm tra trước khi hao:** làm trái thứ tự tick của ticket.

## Hệ quả
- Đèn đầy vẫn nhận một đom đóm sau tick hao đầu tiên (99.98 → 100). Đây là hành vi nhất quán với thứ tự ticket, nhưng có thể làm người chơi thấy lạ; cần hỏi trợ giảng. Test `fuel.test.ts` ghi rõ điều này.
- Làm tròn đầu ra 1 chữ số làm đèn ở 99.97 hiện là 100.0; scenario `p3-refuel` ghi chú điều đó.
- Khoảng cách 6 m ở đầu ra làm tròn 3 chữ số có thể cho 5.999; test dùng dung sai 0.002 m.
- Các test Phase 1–2 về thắng sớm, điểm nhặt đom đóm, và thời lượng đêm không còn đúng; xem `changelog-phase3.md`.
