import os

class Settings:
    SECRET_KEY = "your-secret-key-keep-it-secret" # In production, use env var
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    
    # Database
    DATABASE_URL = "sqlite:///./smartlight.db"
    
    # --- CẤU HÌNH MQTT (LOCAL) ---
    MQTT_BROKER = "localhost"   # Chạy trên cùng máy tính
    MQTT_PORT = 1883            # Port TCP tiêu chuẩn (QUAN TRỌNG: Không phải 8883)
    
    # Với Local EMQX mặc định, user/pass thường không bắt buộc.
    # Để None (hoặc chuỗi rỗng) để kết nối kiểu anonymous.
    MQTT_USERNAME = None        
    MQTT_PASSWORD = None        
    
    # Nếu bạn muốn dùng user mặc định của dashboard để test thì bỏ comment 2 dòng dưới:
    # MQTT_USERNAME = "admin"
    # MQTT_PASSWORD = "public"  (hoặc pass mới bạn đã đổi)

    MQTT_TOPIC_COMMAND = "iot/light/command"
    MQTT_TOPIC_STATUS = "iot/light/status"
    MQTT_CLIENT_ID = "fastapi_server_client"

settings = Settings()
