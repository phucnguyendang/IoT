# 📖 HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY PROJECT IoT SMART LIGHT

## 📋 Mục lục
1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cấu trúc Project](#2-cấu-trúc-project)
3. [Cài đặt môi trường](#3-cài-đặt-môi-trường)
4. [Cấu hình MQTT Broker](#4-cấu-hình-mqtt-broker)
5. [Khởi chạy Backend Server](#5-khởi-chạy-backend-server)
6. [Sử dụng Web Client](#6-sử-dụng-web-client)
7. [Test hệ thống](#7-test-hệ-thống)
8. [API Reference](#8-api-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Yêu cầu hệ thống

### Phần mềm cần cài đặt:
| Phần mềm | Phiên bản | Mục đích |
|----------|-----------|----------|
| **Python** | 3.9 trở lên | Chạy Backend Server |
| **pip** | Mới nhất | Quản lý Python packages |
| **Git** | Mới nhất | Clone project (optional) |
| **Trình duyệt** | Chrome/Firefox/Edge | Truy cập Web Client |

### Kiểm tra phiên bản Python:
```bash
python --version
# hoặc
python3 --version
```

> ⚠️ **Lưu ý**: Trên Windows, sử dụng `python`. Trên Linux/macOS, có thể cần sử dụng `python3`.

---

## 2. Cấu trúc Project

```
IoT/
├── backend_app/                 # Backend FastAPI Server
│   ├── main.py                  # Entry point của ứng dụng
│   ├── config.py                # Cấu hình (MQTT, JWT, Database)
│   ├── database.py              # Kết nối SQLite
│   ├── mqtt_service.py          # Xử lý MQTT (subscribe/publish)
│   ├── requirements.txt         # Python dependencies
│   ├── models/
│   │   └── device.py            # Database models (User, DeviceState, SensorHistory, UserSettings)
│   ├── schemas/
│   │   └── device_schema.py     # Pydantic schemas
│   └── routers/
│       ├── auth.py              # API Authentication
│       └── control.py           # API Device Control
│
├── frontend/                    # Web Client
│   ├── index.html               # Trang chính
│   ├── styles.css               # CSS styling
│   └── app.js                   # JavaScript logic
│
├── create_user.py               # Script khởi tạo user & database
├── test_integration.py          # Script test tích hợp
├── smartlight.db                # SQLite Database (tự động tạo)
├── README.md                    # Mô tả project
├── SETUP_GUIDE.md               # File này
└── system_design.md             # Thiết kế hệ thống chi tiết
```

---

## 3. Cài đặt môi trường

### Bước 1: Mở Terminal/Command Prompt

**Windows:**
- Nhấn `Win + R`, gõ `cmd` hoặc `powershell`, Enter

**macOS/Linux:**
- Mở Terminal

### Bước 2: Di chuyển đến thư mục project

```bash
cd D:\IoT
# hoặc đường dẫn tương ứng trên máy bạn
```

### Bước 3: Tạo Virtual Environment (khuyến nghị)

```bash
# Tạo virtual environment
python -m venv venv

# Kích hoạt virtual environment
# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate
```

> 💡 **Tip**: Khi virtual environment được kích hoạt, bạn sẽ thấy `(venv)` ở đầu dòng lệnh.

### Bước 4: Cài đặt các thư viện cần thiết

```bash
pip install -r backend_app/requirements.txt
```

**Danh sách thư viện sẽ được cài:**
| Thư viện | Mục đích |
|----------|----------|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `sqlalchemy` | ORM cho database |
| `pydantic` | Data validation |
| `paho-mqtt` | MQTT client |
| `python-jose` | JWT token |
| `passlib` | Password hashing |
| `bcrypt` | Bcrypt algorithm |
| `python-multipart` | Form data parsing |
| `aiofiles` | Async file serving |

### Bước 5: Khởi tạo Database và User

```bash
python create_user.py
```

**Output mong đợi:**
```
==================================================
🚀 KHỞI TẠO HỆ THỐNG IoT SMART LIGHT
==================================================

📦 Tạo database tables...
✅ Database tables đã sẵn sàng.

👤 Tạo user admin...
✅ User 'admin' đã được tạo thành công.

💡 Khởi tạo trạng thái thiết bị...
✅ Đã khởi tạo trạng thái thiết bị mặc định.

⚙️  Khởi tạo cài đặt người dùng...
✅ Đã khởi tạo cài đặt ngưỡng mặc định.

==================================================
✅ HOÀN TẤT KHỞI TẠO!
==================================================

📌 Thông tin đăng nhập:
   Username: admin
   Password: admin
```

---

## 4. Cấu hình MQTT Broker

### Cấu hình mặc định (EMQX Cloud)

File `backend_app/config.py` đã được cấu hình sẵn:

```python
MQTT_BROKER = "w187ffa1.ala.eu-central-1.emqxsl.com"
MQTT_PORT = 8883
MQTT_USERNAME = "phucnd"
MQTT_PASSWORD = "phucnd"
MQTT_TOPIC_COMMAND = "iot/light/command"
MQTT_TOPIC_STATUS = "iot/light/status"
```

### Thay đổi cấu hình MQTT (nếu cần)

Mở file `backend_app/config.py` và chỉnh sửa:

```python
class Settings:
    # ... other settings ...
    
    # MQTT - Thay đổi các giá trị này nếu dùng broker khác
    MQTT_BROKER = "your-broker-host.com"
    MQTT_PORT = 8883  # Hoặc 1883 nếu không dùng TLS
    MQTT_USERNAME = "your-username"
    MQTT_PASSWORD = "your-password"
    MQTT_TOPIC_COMMAND = "your/topic/command"
    MQTT_TOPIC_STATUS = "your/topic/status"
```

> ⚠️ **Lưu ý**: Nếu dùng port `1883` (không TLS), cần comment/xóa dòng `self.client.tls_set()` trong file `mqtt_service.py`.

---

## 5. Khởi chạy Backend Server

### Cách 1: Chạy với auto-reload (Development)

```bash
uvicorn backend_app.main:app --reload --host 0.0.0.0 --port 8000
```

### Cách 2: Chạy production mode

```bash
uvicorn backend_app.main:app --host 0.0.0.0 --port 8000
```

**Output khi chạy thành công:**

```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
==================================================
🚀 IoT Smart Light Backend đã khởi động!
📡 Đang kết nối đến MQTT Broker...
==================================================
Connected to MQTT Broker!
Subscribed to iot/light/status
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Truy cập ứng dụng:

| URL | Mô tả |
|-----|-------|
| http://127.0.0.1:8000/ | Web Client (Frontend) |
| http://127.0.0.1:8000/docs | API Documentation (Swagger UI) |
| http://127.0.0.1:8000/redoc | API Documentation (ReDoc) |
| http://127.0.0.1:8000/health | Health Check Endpoint |

---

## 6. Sử dụng Web Client

### Đăng nhập

1. Mở trình duyệt, truy cập `http://127.0.0.1:8000/`
2. Nhập thông tin:
   - **Username:** `admin`
   - **Password:** `admin`
3. Nhấn **Đăng nhập**

### Giao diện Dashboard

Sau khi đăng nhập, bạn sẽ thấy các thành phần:

#### 1. Trạng thái thiết bị
- Hình bóng đèn hiển thị trạng thái ON/OFF
- Độ sáng hiện tại (%)
- Giá trị cảm biến ánh sáng
- Chế độ hoạt động (Tự động/Thủ công)

#### 2. Điều khiển
- **Nút nguồn**: Bật/tắt đèn
- **Thanh trượt độ sáng**: Điều chỉnh 0-100%
- **Toggle Auto Mode**: Bật/tắt chế độ tự động

#### 3. Cài đặt ngưỡng tự động
- **Ngưỡng tối**: Dưới mức này → Tự động BẬT đèn
- **Ngưỡng sáng**: Trên mức này → Tự động TẮT đèn
- **Độ sáng tự động**: Độ sáng khi bật tự động

#### 4. Biểu đồ lịch sử
- Hiển thị dữ liệu cảm biến và độ sáng theo thời gian
- Có thể chọn khoảng thời gian: 1h, 6h, 24h, 3 ngày, 7 ngày

---

## 7. Test hệ thống

### Test với MockESP32 (Giả lập thiết bị)

```bash
# Cài thêm thư viện test (nếu chưa có)
pip install requests

# Chạy test integration
python test_integration.py
```

**Script sẽ thực hiện:**
1. Kết nối MockESP32 đến MQTT Broker
2. Đăng nhập lấy token
3. Test điều khiển độ sáng
4. Test bật/tắt đèn
5. Test chế độ tự động
6. Test nhận dữ liệu cảm biến

### Test API thủ công với Swagger UI

1. Truy cập `http://127.0.0.1:8000/docs`
2. Nhấn **Authorize** (ổ khóa màu xanh)
3. Đăng nhập với `admin/admin`
4. Thử các endpoint:
   - `GET /api/device/status` - Xem trạng thái
   - `POST /api/device/control` - Gửi lệnh điều khiển
   - `GET /api/device/settings` - Xem cài đặt
   - `GET /api/device/history` - Xem lịch sử

---

## 8. API Reference

### Authentication

#### POST /token
Đăng nhập lấy access token.

**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/token" \
  -d "username=admin&password=admin"
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Device Control

#### GET /api/device/status
Lấy trạng thái thiết bị hiện tại.

**Response:**
```json
{
  "is_on": true,
  "brightness": 75,
  "sensor_value": 450,
  "is_auto_mode": false,
  "last_updated": "2024-01-15T10:30:00"
}
```

#### POST /api/device/control
Gửi lệnh điều khiển.

**Actions:**
| Action | Tham số | Mô tả |
|--------|---------|-------|
| `TOGGLE_POWER` | `state: true/false` | Bật/tắt đèn |
| `SET_BRIGHTNESS` | `value: 0-100` | Đặt độ sáng |
| `SET_AUTO` | `enable: true/false` | Bật/tắt chế độ tự động |

**Ví dụ:**
```bash
# Bật đèn
curl -X POST "http://127.0.0.1:8000/api/device/control" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "TOGGLE_POWER", "state": true}'

# Đặt độ sáng 80%
curl -X POST "http://127.0.0.1:8000/api/device/control" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "SET_BRIGHTNESS", "value": 80}'
```

#### GET /api/device/settings
Lấy cài đặt ngưỡng tự động.

#### PUT /api/device/settings
Cập nhật cài đặt ngưỡng.

**Request:**
```json
{
  "light_threshold_low": 300,
  "light_threshold_high": 700,
  "auto_brightness": 80
}
```

#### GET /api/device/history
Lấy lịch sử cảm biến.

**Query Parameters:**
- `hours`: Số giờ (1-168, mặc định 24)
- `limit`: Số bản ghi tối đa (1-1000, mặc định 100)

---

## 9. Troubleshooting

### Lỗi "Module not found"

```bash
# Cài lại dependencies
pip install -r backend_app/requirements.txt
```

### Lỗi kết nối MQTT

1. Kiểm tra internet connection
2. Kiểm tra cấu hình trong `config.py`
3. Đảm bảo MQTT Broker đang hoạt động

### Lỗi "Address already in use"

Port 8000 đang bị sử dụng. Giải pháp:

```bash
# Dùng port khác
uvicorn backend_app.main:app --port 8001 --reload

# Hoặc tắt process đang dùng port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/macOS:
lsof -i :8000
kill -9 <PID>
```

### Database bị lỗi

Xóa và tạo lại database:

```bash
# Xóa file database cũ
del smartlight.db  # Windows
rm smartlight.db   # Linux/macOS

# Chạy lại script khởi tạo
python create_user.py
```

### Frontend không load

1. Đảm bảo server đang chạy
2. Kiểm tra URL: `http://127.0.0.1:8000/` (không phải `localhost`)
3. Xóa cache trình duyệt (Ctrl+Shift+R)

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra lại các bước trong hướng dẫn
2. Xem log trong terminal để debug
3. Kiểm tra API docs tại `/docs`

---

**Happy Coding! 🚀**

