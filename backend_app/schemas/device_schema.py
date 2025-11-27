from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class DeviceStatus(BaseModel):
    is_on: bool
    brightness: int
    sensor_value: int
    is_auto_mode: bool

class ControlRequest(BaseModel):
    action: str # SET_BRIGHTNESS, TOGGLE_POWER, SET_AUTO
    value: Optional[int] = None # For brightness
    enable: Optional[bool] = None # For auto mode
    state: Optional[bool] = None # For power
