# LMS-Gemini Bridge

Tự động hóa việc gửi câu hỏi từ LMS (lms.dut.udn.vn) sang Gemini và nhận câu trả lời về.

## 🎯 Cách hoạt động

```
LMS (Browser) → Bridge Server (Python) → Gemini (Browser)
    ↑                                              ↓
    └──────────────────────────────────────────────┘
           Tự động điền câu trả lời vào LMS
```

## 📦 Cài đặt

### 1. Khởi chạy Bridge Server

```bash
cd /home/loccun/Documents/GitHub/oh-my-vibe-userscript/src/productivity/lms-gemini-bridge/server
python3 bridge_server.py
```

Server sẽ chạy tại `http://localhost:8081`

### 2. Cài đặt Userscript

Cài đặt script `lms-gemini-bridge.user.js` vào Tampermonkey/Violentmonkey.

Script này sẽ tự động hoạt động trên:
- `lms.dut.udn.vn/*`
- `gemini.google.com/app*`

## 🚀 Sử dụng

1. **Mở LMS** và vào trang làm bài quiz
2. **Nhấn nút "🤖 Ask Gemini (Auto)"** - câu hỏi sẽ tự động gửi sang Bridge Server
3. **Tab Gemini sẽ tự động mở** (lần đầu) hoặc nhận câu hỏi nếu đã mở sẵn
4. **Gemini sẽ tự động nhận câu hỏi** và bạn chỉ cần nhấn gửi
5. **Câu trả lời từ Gemini** sẽ tự động gửi về LMS và điền vào các ô trả lời

## 🔧 Cấu hình

### Thay đổi Port

Trong `bridge_server.py`:
```python
PORT = 8081  # Đổi port nếu cần
```

Trong `lms-gemini-bridge.user.js`:
```javascript
const RELAY_URL = 'http://localhost:8081';
```

### API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/` (action: lms_question) | POST | LMS gửi câu hỏi |
| `/` (action: gemini_answer) | POST | Gemini gửi câu trả lời |
| `/lms/poll` | GET | LMS kiểm tra câu trả lời |
| `/gemini/poll` | GET | Gemini kiểm tra câu hỏi mới |
| `/` (action: clear_all) | POST | Xóa dữ liệu |

## 🐛 Khắc phục lỗi

### Lỗi kết nối
- Đảm bảo server đang chạy: `python3 bridge_server.py`
- Kiểm tra port 8081 không bị chiếm dụng
- Kiểm tra firewall cho phép localhost connections

### Gemini không nhận câu hỏi
- Mở Console (F12) trên tab Gemini để xem log
- Đảm bảo userscript đã được kích hoạt trên gemini.google.com/app

### Câu trả lời không tự động điền
- Kiểm tra định dạng JSON từ Gemini có đúng không
- Xem log trong Console trên tab LMS

## 📝 Lưu ý

- Script yêu cầu cả 2 tab (LMS và Gemini) đều được mở
- Gemini cần được đăng nhập sẵn
- Server chỉ chạy local, không thể dùng từ xa
- JSON response từ Gemini phải đúng format: `{"answers": [...]}`

## 🛑 Dừng Server

Nhấn `Ctrl+C` trong terminal chạy server.

## 📄 License

MIT License - giống như dự án chính.
