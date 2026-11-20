# Retro cuối: Đảo Đèn Lồng (phase 1–4, v1.0.0)

## Tổng quan
- Bốn phase, bốn tag (`phase-1` đến `phase-4`) và bản phát hành `v1.0.0`.
- Phase 1: game 3D một đảo, contract v1.0. Phase 2: ba đảo, ba đêm, contract v1.1. Phase 3: đèn có dầu, thắng lúc bình minh, contract v1.2. Phase 4: bench, soak, bảng xếp hạng, trợ năng, đóng gói, contract v1.3.
- Số liệu cuối: 171 test Vitest, 33 scenario headless (mỗi scenario chạy 2 lần để kiểm tra tất định), bench và soak chạy thật, CI xanh trên Ubuntu và macOS ở các commit đã kiểm.

## Hiệu quả
- Test contract headless tách luật khỏi hiển thị. Luật chạy bằng cùng một `step()` cho client và CLI, nên phần lớn lỗi luật được bắt bằng test, không cần chạy trình duyệt.
- Scenario với `expect.json` là bằng chứng có thể chạy lại. `proof.mjs --check` cho kết quả giống nhau giữa các lần chạy.
- Quy tắc "kỳ vọng lấy từ ticket, không lấy từ kết quả chạy" giúp phát hiện sớm vài test sai.
- Hook Stop chặn khi test đỏ, nên không kết thúc phiên với test lỗi.

## Không hiệu quả
- Phase 3 có nhiều test sai ở phía test: sai thứ tự tick, sai ngưỡng làm tròn, thiếu `snapshot_every`. Mỗi lỗi phải đối chiếu lại ticket, tốn thời gian.
- Shell trên Windows hay lỗi với ký tự đặc biệt (dấu nháy, backtick, heredoc). Chuyển sang script Node hoặc công cụ Edit/Write giảm lỗi.
- Trình duyệt chỉ xác nhận được giao diện khi chạy thật. Nhiều mục trợ năng mới chỉ kiểm bằng test và đọc code, chưa kiểm bằng mắt.

## AI sai ở đâu và cách phát hiện
- Phase 1: test kỳ vọng vận tốc chuẩn hóa chính xác; sửa bằng so sánh theo từng trục.
- Phase 2: Bóng Mực chuyển từ lang thang sang đuổi trễ một tick (test "đuổi với 4 m/s" đỏ); sửa bằng di chuyển ngay trong tick chuyển.
- Phase 2: Bóng Mực Đêm 3 kẹt trong vách; phát hiện bằng chạy headless dài, sửa bằng điểm đi cùng tầng và đổi điểm mỗi 120 tick.
- Phase 3: đèn đầy vẫn nhận 1 đom đóm vì dầu hao trước tương tác. Đây là hệ quả đúng của thứ tự ticket, không phải lỗi; ghi vào ADR và chờ trợ giảng xác nhận.
- Phase 4: lỗi `Buffer` bị `JSON.stringify` trong server, phát hiện khi đọc lại code trước khi chạy; script bench treo một lần, không tái hiện được sau đó; phép đo soak dao động giữa các lần chạy.
- Phase 4: một lệnh dọn tiến trình quá rộng bị chặn; đã bỏ và không chạy.

## Harness giúp nhiều nhất
1. `AGENTS.md` và `CLAUDE.md`: quy tắc kiến trúc (core không import DOM), thứ tự tick, và không hard-code số trong ticket.
2. Skill `run-proof` và `proof.mjs`: sinh bằng chứng từ mã đã commit, không sửa tay.
3. Hook Stop: chặn kết thúc khi test đỏ.
4. Skill `verify-client`: hướng dẫn kiểm giao diện bằng trình duyệt, kèm hook dev `window.__ddl`.

## Token và chi phí
- Chưa có số đo chính xác theo từng phase. Nhật ký `docs/notes/ai-log.md` có ước lượng cho phase 2 và 3; phase 4 chưa điền.
- Cách tiết kiệm đã dùng: đổi sang model nhẹ hơn cho việc lặp lại, tránh đọc lại file đã đọc, dùng Edit thay vì ghi lại toàn bộ file, và gom các lệnh độc lập vào một lượt.

## Nếu làm lại
1. Viết trước bảng "định nghĩa đo" cho soak và bench, và hỏi giảng viên khi định nghĩa mơ hồ (`mem_start` đo lúc nào). Đây là điểm vướng nhiều nhất ở phase 4.
2. Kiểm trợ năng bằng trình duyệt ngay khi làm từng tính năng, không gom cuối phase.
3. Ghi token từng phase vào nhật ký ngay khi kết thúc phase.
4. Chạy clone sạch sớm hơn, từ phase 1, để README không lệch với thực tế.
