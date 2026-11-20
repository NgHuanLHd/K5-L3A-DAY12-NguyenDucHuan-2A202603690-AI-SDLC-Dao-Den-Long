# Nhật ký dùng AI

## Token / chi phí
| Phase | Công cụ / model | Token hoặc chi phí ước tính | Số phiên agent | Cách tiết kiệm |
|---|---|---|---|---|
| Setup | Claude Code (Opus 5.5 / Sonnet 5.5) | ~100k token ngữ cảnh (ước tính) | 1 | Chép spec Phase 1 vào `docs/lab/PRD-0.md` để không phải mở lại lab board |
| 1 | Claude Code (Opus 5.5 / Sonnet 5.5) | ~200k token ngữ cảnh thêm (ước tính) | 1 | Kiểm tra bằng headless/test thay vì chơi thử nhiều lần; viết toàn bộ luật trong một lượt theo danh sách giả định đã chốt |
| 2 | Claude Code: Opus 5.5 đọc ticket + lập kế hoạch, Sonnet 5.5 viết mã | ~270k token ngữ cảnh thêm (ước tính; phiên đo ~570k ở cuối Phase 2, hạn mức tuần đã dùng 92%) | 1 | Chép ticket vào repo; kế hoạch có tiêu chí + giả định trước khi code; đổi sang Sonnet cho phần viết mã; kiểm bằng test/headless trước, trình duyệt chỉ để chụp ảnh |
| 3 | Claude Code (Haiku 5.5 đọc ticket, viết mã; Opus 5.5 đã dùng trước đó cho kế hoạch Phase 2) | ~300k token ngữ cảnh thêm (ước tính, chưa đo tổng); tổng ngữ cảnh đã dùng hơn 1M token cửa sổ qua nhiều phiên | 1 | Ghi quyết định vào ADR trước khi viết mã; test luật cũ bị thay được xóa có lý do; scenario sinh bằng script; tránh chạy trình duyệt cho đến khi cần ảnh |
| 4 | | | | |

**Cách ước tính (trung thực về độ chính xác):**
- Đo thật: ngữ cảnh của phiên Claude Code đã dùng khoảng **300k / 1M token** sau khi hoàn thành Phase 1, gồm đọc tài liệu lab, setup, viết luật, test, kiểm tra trên trình duyệt và rà soát contract (công cụ `get_usage`, lúc 2026-11-20 ~15:20 ICT). Con số này là kích thước cửa sổ, không phải tổng token đã tính phí qua các lượt, vì công cụ không cho biết tổng đó.
- Ước tính: chia khoảng 1/3 cho Setup và 2/3 cho Phase 1 theo khối lượng công việc. Hạn mức 5 giờ của gói đã dùng khoảng 32% tại thời điểm đo.
- Đổi model giữa chừng (Opus, Sonnet, Haiku) cho các việc nhẹ như hướng dẫn và giải thích.
- Tiết kiệm: kiểm bằng headless/test thay vì chơi thử; viết luật trong một lượt sau khi chốt giả định; không chạy agent con; chép spec vào repo để khỏi đọc lại lab board.

## Prompt chính
- Setup: "hoàn thiện nốt các bước setup" → tạo khung TS + Three.js, headless theo contract, test, harness.
- Phase 1: "kiểm tra đã đúng/đủ PRD-0 chưa, có bug không (E, F không chạy, đi xuyên vật thể)" → AI liệt kê thiếu sót và chạy headless xác nhận lỗi.
- Phase 2: dán Ticket-02, "đọc kĩ yêu cầu, lên kế hoạch cụ thể, chuyển sang model thấp hơn" → ticket vào repo, `phase-2-plan.md` (12 nhiệm vụ, AC-201 đến AC-217, 22 giả định); "thực hiện phase 2 đúng như kế hoạch" → lõi + test + scenario + client.
- Phase 1: "làm nốt phase 1, đủ yêu cầu" → chốt giả định A7–A18, viết luật trong `src/core/world.ts`, 23 test luật, 7 scenario, cập nhật client.

## Lỗi của AI
| Phase | AI sai gì | Phát hiện bằng cách nào | Đã chỉnh harness gì |
|---|---|---|---|
| Setup | Bản PRACTICE.md đầu tiên đoán sai định dạng scenario (motes là object) trước khi đọc kỹ contract | Đối chiếu với lab board | Chép nguyên contract vào `docs/lab/PRD-0.md`, AGENTS.md trỏ tới đó |
| Setup | Test chuẩn hóa `move` so độ dài vector sau khi mỗi trục đã làm tròn 3 chữ số, nên lệch 0.0007 | Test đỏ | Sửa test so từng trục (chặt hơn), không nới sai số |
| Setup | Bước setup để lại luật Phase 1 dạng TODO nhưng README và giả định đã ghi "Mây bị giữ trong đảo" | Người dùng hỏi kiểm tra, headless cho thấy Mây đi tới z = 75 | Phase 1: thêm biên đảo và test `Island boundary` |
| 1 | Kiểm tra phím E/F trên trình duyệt khi khung xem trước bị ẩn: vòng lặp game bị tạm dừng nên trạng thái chạy dồn, kết quả không đáng tin | Ảnh chụp cho thấy thua ngay sau vài khung hình | Chỉ dùng ảnh để kiểm tra hiển thị; luật kiểm bằng test headless; phím E/F cần người chơi thử |
| 2 | Ở Đêm 3, Bóng Mực không bao giờ chạm Mây trong 6 phút | Chạy `--night 3` 21 600 tick với Mây đứng yên: 0 sự kiện `player_hit` (Đêm 1 và 2 thì có) | Sửa `randomWaypoint` (cùng tầng, đổi điểm mỗi 120 tick); thêm test Bóng Mực kẹt vách |
| 2 | Vài test đầu sai ở phía test, không phải phía luật: `ticks` ngắn hơn thời điểm cần xem, Bóng Mực đặt ở 20 m rồi kỳ vọng đuổi (bỏ đuổi từ 18 m), quên `night_start` trong danh sách event | Test đỏ; đọc lỗi rồi đối chiếu với ticket (không chỉnh ngưỡng cho khớp mã) | `AGENTS.md`: kỳ vọng tính từ ticket; sửa test phải có lý do |
| 2 | Lẫn "frame tick k" với "trạng thái tick k+1" khi tính thời điểm lướt và choáng (lệch 1 tick) | Chạy thử rồi đối chiếu mô hình tick của contract | Ghi chú mô hình tick vào đầu các test |
| 2 | Tạo nhiều scenario bằng shell bị lỗi nháy đơn, rồi lỗi dấu backtick khi ghi nhật ký | Bash báo EOF / "command not found" | Dùng script Node với JSON.stringify (không commit) và công cụ Edit cho văn bản có ký tự đặc biệt |
| 2 | Khung xem trước bị ẩn nên vòng lặp hoạt hình chỉ chạy ~2 khung/giây; đọc trạng thái pause ngay sau phím Esc thấy chưa đổi | So ảnh chụp với trạng thái đọc ngay | Thêm `__ddl.sync()` và `advance()` (chỉ bản dev) và skill `verify-client` nêu rõ giới hạn |
| 2 | Khi chuyển Đêm, client chỉ xóa danh sách đối tượng chứ không gỡ khỏi cảnh: đom đóm của Đêm trước còn lơ lửng quanh đảo mới | Người dùng hỏi "còn phần các bản đồ đâu" nên tôi chụp bản đồ từ trên cao và thấy chấm lạ ngoài đảo | Sửa `loadNight` (gỡ mesh khỏi cảnh trước khi xóa); kiểm: số đom đóm trong cảnh = trong game sau khi qua 3 Đêm. Chưa có test tự động cho phần hiển thị này |
| 3 | Test Phase 2 có kỳ vọng "thắng ngay khi thắp đủ" và "điểm nhặt đom đóm": đây là luật bị thay, không phải lỗi mã | Test đỏ đúng chỗ luật đổi; đọc ticket để xác nhận từng luật bị thay | Xóa khối test cũ (ghi lý do trong file), viết test mới theo ticket; ghi vào `changelog-phase3.md` |
| 3 | Bóng Mực kẹt đuổi ở đúng mép 6 m khi Mây đứng sát đèn: lỗi test chứ không phải luật (khoảng 5.9 là giữa lúc đẩy) | Đọc chuỗi vị trí từng tick (dbg) | Test chỉ đánh giá sau khi đẩy xong (tick 3 trở đi) |
| 3 | Đèn 100 vẫn nhận 1 đom đóm vì dầu hao trước tương tác, trái với trực giác "đèn đầy" | Test `fuel.test.ts` ghi rõ; đối chiếu thứ tự tick của ticket | Giữ đúng thứ tự ticket; ghi ADR-001 và câu hỏi P2 cho trợ giảng |
| 3 | Tôi đề xuất thêm `snapshot_every 1` và sửa mong đợi làm tròn: một số kiểm tra ban đầu trỏ tới tick không có snapshot | Lỗi "no snapshot at tick" của proof | Thêm `snapshot_every` vào các scenario cần đọc từng tick (cấu hình kiểm tra, không đổi luật) |
| 3 | Thanh dầu trên đèn: lần đầu đặt sai vị trí (trôi khỏi đèn) và thanh HUD số đom đóm đè lên góc trên trái | Ảnh trình duyệt | Sửa vị trí thanh; đặt `#hudCapacity` trên thanh đom đóm |
