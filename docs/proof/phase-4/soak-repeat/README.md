# Soak lặp lại (bổ sung cho `../soak.json`)

`../soak.json` là lần chạy chính thức, ghi FAIL: `mem_start` 37.2 MB, `mem_end` 49.1 MB (1.32×).

Sau đó chạy lại cùng lệnh 6 lần (mặc định) và 4 lần với `node --max-semi-space-size=1`. Các file JSON ở thư mục này là kết quả thô, không chỉnh sửa.

| Lần chạy | mem_start (MB) | mem_end (MB) | Tỷ lệ | Ngưỡng ≤ 1.2× |
|---|---|---|---|---|
| default-1 | 50.9 | 58.4 | 1.147 | đạt |
| default-2 | 50.8 | 58.0 | 1.142 | đạt |
| default-3 | 50.9 | 58.2 | 1.143 | đạt |
| default-4 | 50.9 | 58.2 | 1.143 | đạt |
| default-5 | 50.9 | 58.6 | 1.151 | đạt |
| default-6 | 50.9 | 58.0 | 1.139 | đạt |
| semi-space-1-1 | 50.9 | 56.0 | 1.100 | đạt |
| semi-space-1-2 | 50.9 | 56.0 | 1.100 | đạt |
| semi-space-1-3 | 51.0 | 56.6 | 1.110 | đạt |
| semi-space-1-4 | 50.9 | 56.5 | 1.110 | đạt |

## Nhận xét
- Lần chính thức khác các lần này ở `mem_start` (37.2 so với ~50.9). Chưa rõ nguyên nhân; có thể do trạng thái bộ nhớ của máy lúc chạy. Nó không đổi định nghĩa đo.
- Heap JS sau GC ổn định ở khoảng 5.5 MB qua nhiều vòng, nên không có rò rỉ JS.
- Chưa đổi code soak. `soak.json` chính thức được giữ nguyên, ghi FAIL.
