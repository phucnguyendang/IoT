from sqlalchemy import Column, Integer, String, Boolean, DateTime
from ..database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class DeviceState(Base):
    __tablename__ = "device_state"

    id = Column(Integer, primary_key=True, index=True) # Default 1
    is_on = Column(Boolean, default=False)
    brightness = Column(Integer, default=0)
    sensor_value = Column(Integer, default=0) # Light sensor value
    is_auto_mode = Column(Boolean, default=False)
    last_updated = Column(DateTime, default=datetime.utcnow)
