from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.device import DeviceState, User
from ..schemas.device_schema import DeviceStatus, ControlRequest
from ..mqtt_service import mqtt_service
from .auth import get_current_user
from datetime import datetime

router = APIRouter(
    prefix="/api/device",
    tags=["device"],
    responses={404: {"description": "Not found"}},
)

@router.get("/status", response_model=DeviceStatus)
async def get_device_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    device = db.query(DeviceState).first()
    if not device:
        # Create default device state if not exists
        device = DeviceState(is_on=False, brightness=0, is_auto_mode=False)
        db.add(device)
        db.commit()
        db.refresh(device)
    return device

@router.post("/control")
async def control_device(request: ControlRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Lấy trạng thái hiện tại từ DB chỉ để tham khảo (ví dụ: độ sáng hiện tại nếu chỉ bật/tắt)
    # KHÔNG cập nhật DB ở đây nữa. DB sẽ được cập nhật khi ESP32 gửi phản hồi về.
    device = db.query(DeviceState).first()
    if not device:
        device = DeviceState(is_on=False, brightness=0, is_auto_mode=False)
        db.add(device)
        db.commit()
        db.refresh(device)

    mqtt_payload = {}

    if request.action == "SET_BRIGHTNESS":
        if request.value is not None:
            # Chỉ tạo payload gửi đi, không update DB
            mqtt_payload = {
                "type": "MANUAL",
                "state": "ON" if device.is_on else "OFF", # Giữ nguyên trạng thái ON/OFF hiện tại
                "brightness": request.value
            }
    
    elif request.action == "TOGGLE_POWER":
        # Toggle or set specific state if provided
        target_state = not device.is_on
        if request.state is not None:
            target_state = request.state
        
        mqtt_payload = {
            "type": "MANUAL",
            "state": "ON" if target_state else "OFF",
            "brightness": device.brightness # Giữ nguyên độ sáng hiện tại
        }

    elif request.action == "SET_AUTO":
        if request.enable is not None:
            mqtt_payload = {
                "type": "AUTO",
                "enable": request.enable
            }
    
    if mqtt_payload:
        mqtt_service.publish_command(mqtt_payload)

    return {"status": "success", "message": "Command sent to device"}
