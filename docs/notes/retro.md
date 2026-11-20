# Đánh giá và retro

## Phase 1
- Đạt:
- Chưa đạt (lý do):
- AI sai ở đâu:
- Chỉnh harness:
- Token:

## Phase 2
## Phase 3
## Phase 4

## Retro cả dự án
- Số liệu (test, scenario, token, thời gian):
- Điều hiệu quả:
- Điều không hiệu quả:
- Nếu làm lại:

## Phase 2 (tạm, hoàn thiện ở cuối dự án)
- Đạt: số liệu chuẩn, 3 bản đồ, Gió Lạc, Bùa Gió, tạm dừng, chuỗi 3 Đêm, cài đặt, HUD; 121 test và 23 scenario đạt; Đêm đầy đủ chạy headless ~0.3 s.
- Chưa đạt/chưa kiểm: âm thanh chưa nghe, màu pixel chưa đo, chưa chơi tay qua cả 3 Đêm, 22 giả định chưa hỏi trợ giảng.
- AI sai: Bóng Mực Đêm 3 kẹt vách (phát hiện bằng headless); vài test sai phía test (xem `ai-log.md`).
- Harness: thêm skill `verify-client`, cập nhật `AGENTS.md` và `run-proof`.
- Token: ~270k ngữ cảnh; hạn mức tuần đã dùng 92%.

## Phase 3 (TICKET-03)
- Đạt: mô hình dầu bằng số nguyên, hút dầu, thắng lúc bình minh, sức chứa, điểm mới, contract v1.2, ADR và changelog; 150 test và 33 scenario đạt.
- Chưa đạt/chưa kiểm: thanh dầu từ xa, mù màu bằng mắt, chơi tay qua ba đêm, câu hỏi P2.
- AI sai: test Phase 2 mã hóa luật bị thay (đúng là phải thay, nhưng phải ghi lý do); một số kiểm tra trỏ tới tick không có snapshot; vị trí thanh HUD. Đã sửa và ghi trong `ai-log.md`.
- Bài học: đọc thứ tự tick trước khi viết test về "đèn đầy": hao dầu xảy ra trước tương tác, nên khái niệm "đầy" gần như không xảy ra trong thực tế.
