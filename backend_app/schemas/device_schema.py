from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ============ Authentication Schemas ============
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# ============ Device Status Schemas ============
class DeviceStatus(BaseModel):
    is_on: bool
    brightness: int
    sensor_value: int
    is_auto_mode: bool

class DeviceStatusFull(DeviceStatus):
    """Extended device status with timestamp"""
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True

# ============ Control Request Schemas ============
class ControlRequest(BaseModel):
    action: str  # SET_BRIGHTNESS, TOGGLE_POWER, SET_AUTO
    value: Optional[int] = None  # For brightness (0-100)
    enable: Optional[bool] = None  # For auto mode
    state: Optional[bool] = None  # For power

# ============ Sensor History Schemas ============
class SensorHistoryItem(BaseModel):
    id: int
    sensor_value: int
    brightness: int
    is_on: bool
    is_auto_mode: bool
    timestamp: datetime

    class Config:
        from_attributes = True

class SensorHistoryResponse(BaseModel):
    data: List[SensorHistoryItem]
    total: int

# ============ User Settings Schemas ============
class UserSettingsBase(BaseModel):
    light_threshold_low: int = 300  # Ngưỡng tối (dưới mức này bật đèn)
    light_threshold_high: int = 700  # Ngưỡng sáng (trên mức này tắt đèn)
    auto_brightness: int = 80  # Độ sáng khi bật tự động

class UserSettingsCreate(UserSettingsBase):
    pass

class UserSettingsUpdate(BaseModel):
    light_threshold_low: Optional[int] = None
    light_threshold_high: Optional[int] = None
    auto_brightness: Optional[int] = None

class UserSettingsResponse(UserSettingsBase):
    id: int
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True

# ============ Dashboard Summary Schema ============
class DashboardSummary(BaseModel):
    device_status: DeviceStatus
    settings: UserSettingsResponse
    recent_history_count: int
