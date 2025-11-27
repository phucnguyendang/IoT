Dưới đây là bản báo cáo thiết kế chi tiết hệ thống (System Design Document) tập trung vào phần **Backend Server**, được biên soạn để bạn có thể sử dụng trực tiếp cho đồ án hoặc tài liệu kỹ thuật của mình.

-----

# BÁO CÁO THIẾT KẾ VÀ TRIỂN KHAI HỆ THỐNG IOT SMART LIGHT

**Phân hệ: Backend Service & API Gateway**

## I. Giới thiệu hệ thống

Hệ thống **IoT Smart Light** là giải pháp điều khiển và giám sát thiết bị chiếu sáng từ xa thông qua môi trường Internet. Hệ thống cho phép người dùng tương tác qua giao diện Web để điều khiển độ sáng đèn LED, bật/tắt thiết bị, và kích hoạt chế độ tự động điều chỉnh độ sáng dựa trên cường độ ánh sáng môi trường (thu thập từ cảm biến quang trở LDR).

**Vai trò của Server (Backend Service):**
Server đóng vai trò là bộ não trung tâm và cổng kết nối (Gateway), chịu trách nhiệm:

1.  **Cung cấp API:** Cho phép Client (Web/App) gửi lệnh và lấy dữ liệu.
2.  **Quản lý trạng thái:** Lưu trữ trạng thái hiện tại của thiết bị vào Database.
3.  **Cầu nối giao tiếp:** Chuyển đổi các yêu cầu HTTP từ Web thành các bản tin MQTT gửi tới thiết bị phần cứng (ESP32) thông qua Broker.

-----

## II. Các chức năng hệ thống (Phía Server)

Server được thiết kế để đáp ứng 4 nhóm chức năng chính:

### 1\. Quản lý xác thực (Authentication)

  * **Đăng nhập:** Xác thực người dùng qua Username/Password.
  * **Cấp quyền:** Cấp phát Access Token (JWT) để bảo mật các API điều khiển.

### 2\. Điều khiển thiết bị (Control)

  * **Bật/Tắt đèn:** Gửi lệnh ON/OFF tới thiết bị.
  * **Điều chỉnh độ sáng (Dimming):** Gửi giá trị độ sáng cụ thể (0-100%) tới thiết bị.
  * **Chế độ tự động (Auto Mode):** Kích hoạt/Vô hiệu hóa tính năng tự động điều chỉnh độ sáng trên ESP32.

### 3\. Giám sát trạng thái (Monitoring)

  * **Đồng bộ trạng thái:** Cung cấp thông tin hiện tại của đèn (Đang sáng hay tắt? Độ sáng bao nhiêu? Chế độ nào?) cho Web Client để hiển thị chính xác ngay khi tải trang.

### 4\. Giao tiếp MQTT (MQTT Interface)

  * **Publish:** Đẩy lệnh điều khiển xuống Broker (EMQX Cloud).
  * **Subscribe:** Lắng nghe phản hồi hoặc dữ liệu cảm biến từ thiết bị gửi lên (để cập nhật log hoặc trạng thái thực tế).

-----

## III. Thiết kế chi tiết (Mức triển khai)

### 1\. Kiến trúc công nghệ (Tech Stack)

  * **Ngôn ngữ:** Python 3.9+
  * **Framework:** FastAPI (Hiệu năng cao, hỗ trợ Async).
  * **Database:** SQLite (Lưu trữ cục bộ, nhẹ, phù hợp quy mô dự án).
  * **ORM:** SQLAlchemy (Tương tác DB).
  * **MQTT Client:** Paho-MQTT (Giao tiếp với EMQX Cloud).

### 2\. Thiết kế Cơ sở dữ liệu (Database Schema)

Sử dụng SQLite với 2 bảng chính.

#### Bảng `users` (Quản lý người dùng)

| Tên trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | Integer (PK) | ID tự tăng |
| `username` | String | Tên đăng nhập (Unique) |
| `hashed_password`| String | Mật khẩu đã mã hóa (Bcrypt) |

#### Bảng `device_state` (Lưu trạng thái thiết bị)

*Bảng này chỉ chứa 1 dòng duy nhất đại diện cho hệ thống đèn hiện tại.*  
*Bảng sẽ được cập nhật mỗi khi server nhận phản hội từ thiết bị qua MQTT.*
| Tên trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | Integer (PK) | Mặc định là 1 |
| `is_on` | Boolean | Trạng thái nguồn (`True`: Bật, `False`: Tắt) |
| `brightness` | Integer | Độ sáng hiện tại (0 - 100) |
| `sensor_value` | Integer | Giá trị cảm biến ánh sáng (LDR) |
| `is_auto_mode` | Boolean | Chế độ tự động (`True`: Auto, `False`: Manual) |
| `last_updated` | DateTime | Thời gian cập nhật (dựa trên timestamp từ thiết bị) |

### 3\. Thiết kế Giao thức MQTT (Communication Protocol)

Quy định cấu trúc gói tin JSON giao tiếp giữa Server và ESP32 qua EMQX Cloud.

  * **Broker Host:** `w187ffa1.ala.eu-central-1.emqxsl.com` (EMQX Cloud).
  * **Port:** `8883` (SSL/TLS).
  * **Authentication:** Có xác thực (Username/Password).

**Topic Command (Server -\> ESP32):** `iot/light/command`

**Payload JSON (Command):**

  * **Trường hợp 1: Chỉnh độ sáng (Thủ công)**
    ```json
    {
      "type": "MANUAL",
      "state": "ON",      // hoặc "OFF"
      "brightness": 75    // Giá trị 0-100
    }
    ```
  * **Trường hợp 2: Bật chế độ tự động**
    ```json
    {
      "type": "AUTO",
      "enable": true      // true: Bật auto, false: Tắt auto
    }
    ```

**Topic Status (ESP32 -\> Server):** `iot/light/status`

**Payload JSON (Status Feedback):**
Thiết bị gửi lên khi có thay đổi trạng thái hoặc định kỳ.
```json
{
  "is_on": true,
  "brightness": 75,
  "sensor_value": 450,
  "is_auto_mode": false,
  "timestamp": 1716888888 // Unix Timestamp
}
```

### 4\. Thiết kế API Endpoints (FastAPI)

#### Nhóm Authentication

  * **POST** `/token`
      * **Input:** `username`, `password` (FormData).
      * **Output:** `{"access_token": "...", "token_type": "bearer"}`.
      * **Logic:** Kiểm tra DB, nếu đúng pass thì sinh JWT.

#### Nhóm Device Control (Yêu cầu có Token)

  * **GET** `/api/device/status`

      * **Mục đích:** Web gọi API này khi vừa load trang để hiển thị trạng thái đúng.
      * **Output:**
        ```json
        {
          "is_on": true,
          "brightness": 50,
          "sensor_value": 450,
          "is_auto_mode": false
        }
        ```
      * **Logic:** `SELECT * FROM device_state WHERE id=1`.

  * **POST** `/api/device/control`

      * **Mục đích:** Web gửi lệnh điều khiển.
      * **Input Body:**
        ```json
        {
          "action": "SET_BRIGHTNESS", // Các giá trị: TOGGLE_POWER, SET_BRIGHTNESS, SET_AUTO
          "value": 80 // Giá trị đi kèm (nếu cần)
        }
        ```
      * **Logic xử lý:**
        1.  Parse dữ liệu đầu vào.
        2.  Tạo payload JSON tương ứng theo thiết kế MQTT ở mục 3.
        3.  Gọi hàm `mqtt_client.publish()` để gửi lệnh tới Broker.
        4.  Trả về `200 OK`.
        *Lưu ý: API này KHÔNG cập nhật Database ngay lập tức. Database chỉ được cập nhật khi nhận được phản hồi (Feedback) từ thiết bị qua MQTT.*

### 5\. Tổ chức mã nguồn (Project Structure)

Cấu trúc thư mục đề xuất để đảm bảo tính chuyên nghiệp và dễ bảo trì:

```text
/backend_app
│
├── main.py                # Entry point: Khởi tạo FastAPI app, cấu hình CORS
├── config.py              # Biến môi trường: DB URL, MQTT Host, Secret Key
├── database.py            # Kết nối SQLite session
├── mqtt_service.py        # Class xử lý kết nối Paho-MQTT (Connect, Publish)
│
├── models/                # Định nghĩa DB Schema
│   └── device.py          # Class DeviceState, User
│
├── schemas/               # Pydantic Models (Validate request/response)
│   └── device_schema.py   # Định dạng dữ liệu ControlRequest
│
├── routers/               # Chia nhỏ API
│   ├── auth.py            # API Login
│   └── control.py         # API điều khiển đèn
│
└── requirements.txt       # fastapi, uvicorn, sqlalchemy, pydantic, paho-mqtt
```

### 6\. Luồng hoạt động chi tiết (Sequence Flow) - Case Điều chỉnh độ sáng

1.  **User:** Kéo thanh trượt độ sáng lên 80% trên Web.
2.  **Web Client:** Gửi `POST /api/device/control` với body `{"action": "SET_BRIGHTNESS", "value": 80}`.
3.  **FastAPI (Router):**
      * Nhận request, validate token.
      * Gọi `MQTT Service`: Tạo bản tin `{"type": "MANUAL", "brightness": 80}`.
      * Publish bản tin vào topic `iot/light/command`.
      * Trả về `200 OK` cho Web Client (xác nhận lệnh đã gửi).
4.  **EMQX Broker:** Chuyển tiếp bản tin tới ESP32.
5.  **ESP32:**
      * Nhận bản tin.
      * Thực thi điều khiển phần cứng (PWM ra đèn).
      * **Feedback:** Gửi bản tin trạng thái mới lên topic `iot/light/status`.
        ```json
        { "is_on": true, "brightness": 80, "sensor_value": 500, "timestamp": ... }
        ```
6.  **FastAPI (MQTT Service):**
      * Nhận bản tin từ topic `status`.
      * Cập nhật dữ liệu mới vào bảng `device_state`.
7.  **Web Client:** (Sau một khoảng thời gian hoặc qua cơ chế polling) gọi `GET /api/device/status` để hiển thị trạng thái chính xác nhất.

-----

**Kết luận:**
Thiết kế này đảm bảo tính tách biệt giữa các thành phần (Server quản lý logic và trạng thái, ESP32 thực thi phần cứng). Việc sử dụng MQTT Broker EMQX Cloud giúp hệ thống không cần cấu hình Port Forwarding phức tạp, dễ dàng triển khai thực tế.