from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from ..database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class DeviceState(Base):
    __tablename__ = "device_state"

    id = Column(Integer, primary_key=True, index=True)  # Default 1
    is_on = Column(Boolean, default=False)
    brightness = Column(Integer, default=0)
    sensor_value = Column(Integer, default=0)  # Light sensor value (LDR)
    is_auto_mode = Column(Boolean, default=False)
    last_updated = Column(DateTime, default=datetime.utcnow)

class SensorHistory(Base):
    """Bảng lưu lịch sử dữ liệu cảm biến để vẽ biểu đồ"""
    __tablename__ = "sensor_history"

    id = Column(Integer, primary_key=True, index=True)
    sensor_value = Column(Integer, nullable=False)  # Giá trị cảm biến ánh sáng
    brightness = Column(Integer, nullable=False)     # Độ sáng đèn tại thời điểm đó
    is_on = Column(Boolean, default=False)           # Trạng thái đèn
    is_auto_mode = Column(Boolean, default=False)    # Chế độ tự động
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class UserSettings(Base):
    """Bảng lưu cài đặt người dùng (ngưỡng sáng/tối cho chế độ Auto)"""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)  # Default 1
    # Ngưỡng ánh sáng thấp - dưới mức này sẽ tự động bật đèn
    light_threshold_low = Column(Integer, default=300)
    # Ngưỡng ánh sáng cao - trên mức này sẽ tự động tắt đèn  
    light_threshold_high = Column(Integer, default=700)
    # Độ sáng mặc định khi bật tự động
    auto_brightness = Column(Integer, default=80)
    # Thời gian cập nhật cuối
    last_updated = Column(DateTime, default=datetime.utcnow)
