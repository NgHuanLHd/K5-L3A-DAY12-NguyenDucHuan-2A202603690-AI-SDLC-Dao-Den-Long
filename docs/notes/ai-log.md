# Nhật ký dùng AI

## Token / chi phí
| Phase | Công cụ / model | Token hoặc chi phí ước tính | Số phiên agent | Cách tiết kiệm |
|---|---|---|---|---|
| Setup | Claude Code (Opus 5.5 / Sonnet 5.5) | ~100k token ngữ cảnh (ước tính) | 1 | Chép spec Phase 1 vào `docs/lab/PRD-0.md` để không phải mở lại lab board |
| 1 | Claude Code (Opus 5.5 / Sonnet 5.5) | ~200k token ngữ cảnh thêm (ước tính) | 1 | Kiểm tra bằng headless/test thay vì chơi thử nhiều lần; viết toàn bộ luật trong một lượt theo danh sách giả định đã chốt |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

**Cách ước tính (trung thực về độ chính xác):**
- Đo thật: ngữ cảnh của phiên Claude Code đã dùng khoảng **300k / 1M token** sau khi hoàn thành Phase 1, gồm đọc tài liệu lab, setup, viết luật, test, kiểm tra trên trình duyệt và rà soát contract (công cụ `get_usage`, lúc 2026-11-20 ~15:20 ICT). Con số này là kích thước cửa sổ, không phải tổng token đã tính phí qua các lượt, vì công cụ không cho biết tổng đó.
- Ước tính: chia khoảng 1/3 cho Setup và 2/3 cho Phase 1 theo khối lượng công việc. Hạn mức 5 giờ của gói đã dùng khoảng 32% tại thời điểm đo.
- Đổi model giữa chừng (Opus, Sonnet, Haiku) cho các việc nhẹ như hướng dẫn và giải thích.
- Tiết kiệm: kiểm bằng headless/test thay vì chơi thử; viết luật trong một lượt sau khi chốt giả định; không chạy agent con; chép spec vào repo để khỏi đọc lại lab board.

## Prompt chính
- Setup: "hoàn thiện nốt các bước setup" → tạo khung TS + Three.js, headless theo contract, test, harness.
- Phase 1: "kiểm tra đã đúng/đủ PRD-0 chưa, có bug không (E, F không chạy, đi xuyên vật thể)" → AI liệt kê thiếu sót và chạy headless xác nhận lỗi.
- Phase 1: "làm nốt phase 1, đủ yêu cầu" → chốt giả định A7–A18, viết luật trong `src/core/world.ts`, 23 test luật, 7 scenario, cập nhật client.

## Lỗi của AI
| Phase | AI sai gì | Phát hiện bằng cách nào | Đã chỉnh harness gì |
|---|---|---|---|
| Setup | Bản PRACTICE.md đầu tiên đoán sai định dạng scenario (motes là object) trước khi đọc kỹ contract | Đối chiếu với lab board | Chép nguyên contract vào `docs/lab/PRD-0.md`, AGENTS.md trỏ tới đó |
| Setup | Test chuẩn hóa `move` so độ dài vector sau khi mỗi trục đã làm tròn 3 chữ số, nên lệch 0.0007 | Test đỏ | Sửa test so từng trục (chặt hơn), không nới sai số |
| Setup | Bước setup để lại luật Phase 1 dạng TODO nhưng README và giả định đã ghi "Mây bị giữ trong đảo" | Người dùng hỏi kiểm tra, headless cho thấy Mây đi tới z = 75 | Phase 1: thêm biên đảo và test `Island boundary` |
| 1 | Kiểm tra phím E/F trên trình duyệt khi khung xem trước bị ẩn: vòng lặp game bị tạm dừng nên trạng thái chạy dồn, kết quả không đáng tin | Ảnh chụp cho thấy thua ngay sau vài khung hình | Chỉ dùng ảnh để kiểm tra hiển thị; luật kiểm bằng test headless; phím E/F cần người chơi thử |
