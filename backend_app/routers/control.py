from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, timedelta
from ..database import get_db
from ..models.device import DeviceState, User, SensorHistory, UserSettings
from ..schemas.device_schema import (
    DeviceStatus, 
    DeviceStatusFull,
    ControlRequest, 
    SensorHistoryItem,
    SensorHistoryResponse,
    UserSettingsResponse,
    UserSettingsUpdate,
    DashboardSummary
)
from ..mqtt_service import mqtt_service
from .auth import get_current_user
from sqlalchemy import func
from datetime import date

router = APIRouter(
    prefix="/api/device",
    tags=["device"],
    responses={404: {"description": "Not found"}},
)

# ============ HELPER: GET DEVICE STATE ============
def get_or_create_device_state(db: Session):
    device = db.query(DeviceState).filter(DeviceState.id == 1).first()
    if not device:
        device = DeviceState(id=1, is_on=False, brightness=0, is_auto_mode=False)
        db.add(device)
        db.commit()
        db.refresh(device)
    return device

# ============ 1. DEVICE STATUS & CONTROL ============

@router.get("/status", response_model=DeviceStatusFull)
async def get_device_status(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Lấy trạng thái hiện tại của thiết bị"""
    return get_or_create_device_state(db)


@router.post("/control")
async def control_device(
    request: ControlRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Gửi lệnh điều khiển chuẩn xác.
    Đã fix lỗi: Tắt đèn là tắt hẳn (brightness=0), bật Auto là gửi lệnh Auto.
    """
    device = get_or_create_device_state(db)
    mqtt_payload = {}

    # --- CASE 1: CHỈNH ĐỘ SÁNG (SET_BRIGHTNESS) ---
    if request.action == "SET_BRIGHTNESS":
        if request.value is not None:
            val = request.value
            if not 0 <= val <= 100:
                raise HTTPException(status_code=400, detail="Brightness must be 0-100")
            
            # Cập nhật DB
            device.brightness = val
            device.is_on = True        # Có độ sáng tức là đang Bật
            device.is_auto_mode = False # Chỉnh tay thì tắt Auto
            
            mqtt_payload = {
                "type": "MANUAL",
                "state": "ON",
                "brightness": val
            }
    
    # --- CASE 2: BẬT / TẮT NGUỒN (TOGGLE_POWER) ---
    elif request.action == "TOGGLE_POWER":
        # Xác định trạng thái mới
        target_state = request.state if request.state is not None else (not device.is_on)
        
        # Cập nhật DB
        device.is_on = target_state
        
        if target_state == False:
            # NẾU TẮT:
            device.brightness = 0       # Về 0 ngay
            device.is_auto_mode = False # Tắt luôn Auto
            
            mqtt_payload = {
                "type": "MANUAL",
                "state": "OFF",
                "brightness": 0  # <--- QUAN TRỌNG: Gửi 0 để đèn tắt hẳn
            }
        else:
            # NẾU BẬT:
            # Khôi phục độ sáng cũ (hoặc mặc định 50 nếu cũ là 0)
            restore_brightness = device.brightness if device.brightness > 0 else 50
            device.brightness = restore_brightness
            
            mqtt_payload = {
                "type": "MANUAL",
                "state": "ON",
                "brightness": restore_brightness
            }

    # --- CASE 3: CHẾ ĐỘ TỰ ĐỘNG (SET_AUTO) ---
    elif request.action == "SET_AUTO":
        if request.enable is not None:
            # Cập nhật DB
            device.is_auto_mode = request.enable
            if request.enable:
                device.is_on = True # Bật Auto thì mặc định đèn phải ON
            
            mqtt_payload = {
                "type": "AUTO",
                "enable": request.enable
            }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")
    
    # Lưu thay đổi vào Database
    device.last_updated = datetime.utcnow()
    db.commit()
    db.refresh(device)
    
    # Gửi lệnh xuống MQTT
    if mqtt_payload:
        mqtt_service.publish_command(mqtt_payload)

    return {"status": "success", "message": "Command sent", "payload": mqtt_payload}


# ============ 2. SENSOR HISTORY ============

@router.get("/history", response_model=SensorHistoryResponse)
async def get_sensor_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000),
    hours: Optional[int] = Query(default=24, ge=1, le=168)
):
    """Lấy lịch sử dữ liệu cảm biến"""
    start_time = datetime.utcnow() - timedelta(hours=hours)
    query = db.query(SensorHistory).filter(
        SensorHistory.timestamp >= start_time
    ).order_by(desc(SensorHistory.timestamp)).limit(limit)
    
    history_records = query.all()
    history_records.reverse() # Đảo lại để vẽ biểu đồ từ trái qua phải
    
    return SensorHistoryResponse(
        data=[SensorHistoryItem.model_validate(r) for r in history_records],
        total=len(history_records)
    )

@router.delete("/history")
async def clear_sensor_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    keep_hours: int = Query(default=0, ge=0)
):
    """Xóa lịch sử"""
    if keep_hours > 0:
        cutoff = datetime.utcnow() - timedelta(hours=keep_hours)
        deleted = db.query(SensorHistory).filter(SensorHistory.timestamp < cutoff).delete()
    else:
        deleted = db.query(SensorHistory).delete()
    db.commit()
    return {"status": "success", "deleted_records": deleted}


# ============ 3. USER SETTINGS ============

@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy cài đặt ngưỡng"""
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(id=1, light_threshold_low=300, light_threshold_high=700, auto_brightness=80)
        db.add(settings)
        db.commit()
    return settings

@router.put("/settings", response_model=UserSettingsResponse)
async def update_settings(
    update_data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cập nhật cài đặt ngưỡng"""
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(id=1)
        db.add(settings)
    
    if update_data.light_threshold_low is not None: settings.light_threshold_low = update_data.light_threshold_low
    if update_data.light_threshold_high is not None: settings.light_threshold_high = update_data.light_threshold_high
    if update_data.auto_brightness is not None: settings.auto_brightness = update_data.auto_brightness
    
    db.commit()
    db.refresh(settings)
    return settings


# ============ 4. DASHBOARD ============

@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tổng quan Dashboard"""
    device = get_or_create_device_state(db)
    
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(id=1, light_threshold_low=300, light_threshold_high=700, auto_brightness=80)
        db.add(settings)
        db.commit()
    
    start_time = datetime.utcnow() - timedelta(hours=24)
    history_count = db.query(SensorHistory).filter(SensorHistory.timestamp >= start_time).count()
    
    return DashboardSummary(
        device_status=DeviceStatus(
            is_on=device.is_on,
            brightness=device.brightness,
            sensor_value=device.sensor_value,
            is_auto_mode=device.is_auto_mode
        ),
        settings=UserSettingsResponse.model_validate(settings),
        recent_history_count=history_count
    )

@router.get("/history/by-date")
def get_history_by_date(
    target_date: date = Query(..., description="Chọn ngày (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trả về dữ liệu để vẽ biểu đồ cho một ngày cụ thể.
    """
    # Lọc các bản ghi có ngày trùng với target_date
    records = db.query(SensorHistory).filter(
        func.date(SensorHistory.timestamp) == target_date
    ).order_by(SensorHistory.timestamp.asc()).all()

    # Chuyển đổi dữ liệu cho Frontend dễ dùng
    return [
        {
            "timestamp": r.timestamp.strftime("%H:%M:%S"), # Chỉ lấy giờ:phút:giây
            "sensor_value": r.sensor_value,
            "brightness": r.brightness
        }
        for r in records
    ]