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

router = APIRouter(
    prefix="/api/device",
    tags=["device"],
    responses={404: {"description": "Not found"}},
)

# ============ DEVICE STATUS ENDPOINTS ============

@router.get("/status", response_model=DeviceStatusFull)
async def get_device_status(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Lấy trạng thái hiện tại của thiết bị"""
    device = db.query(DeviceState).first()
    if not device:
        device = DeviceState(id=1, is_on=False, brightness=0, is_auto_mode=False)
        db.add(device)
        db.commit()
        db.refresh(device)
    return device


@router.post("/control")
async def control_device(
    request: ControlRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Gửi lệnh điều khiển đến thiết bị.
    Actions: SET_BRIGHTNESS, TOGGLE_POWER, SET_AUTO
    """
    device = db.query(DeviceState).first()
    if not device:
        device = DeviceState(id=1, is_on=False, brightness=0, is_auto_mode=False)
        db.add(device)
        db.commit()
        db.refresh(device)

    mqtt_payload = {}

    if request.action == "SET_BRIGHTNESS":
        if request.value is not None:
            if not 0 <= request.value <= 100:
                raise HTTPException(status_code=400, detail="Brightness must be between 0 and 100")
            mqtt_payload = {
                "type": "MANUAL",
                "state": "ON" if device.is_on else "OFF",
                "brightness": request.value
            }
    
    elif request.action == "TOGGLE_POWER":
        target_state = not device.is_on
        if request.state is not None:
            target_state = request.state
        
        mqtt_payload = {
            "type": "MANUAL",
            "state": "ON" if target_state else "OFF",
            "brightness": device.brightness if device.brightness > 0 else 50
        }

    elif request.action == "SET_AUTO":
        if request.enable is not None:
            mqtt_payload = {
                "type": "AUTO",
                "enable": request.enable
            }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")
    
    if mqtt_payload:
        mqtt_service.publish_command(mqtt_payload)

    return {"status": "success", "message": "Command sent to device", "payload": mqtt_payload}


# ============ SENSOR HISTORY ENDPOINTS ============

@router.get("/history", response_model=SensorHistoryResponse)
async def get_sensor_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000, description="Số lượng bản ghi trả về"),
    hours: Optional[int] = Query(default=24, ge=1, le=168, description="Lấy dữ liệu trong N giờ gần nhất (max 168 = 7 ngày)")
):
    """
    Lấy lịch sử dữ liệu cảm biến để vẽ biểu đồ.
    - limit: Số lượng bản ghi tối đa
    - hours: Lọc theo N giờ gần nhất
    """
    # Tính thời gian bắt đầu
    start_time = datetime.utcnow() - timedelta(hours=hours)
    
    query = db.query(SensorHistory).filter(
        SensorHistory.timestamp >= start_time
    ).order_by(desc(SensorHistory.timestamp)).limit(limit)
    
    history_records = query.all()
    
    # Đảo ngược để có thứ tự từ cũ đến mới (thuận tiện cho biểu đồ)
    history_records.reverse()
    
    return SensorHistoryResponse(
        data=[SensorHistoryItem.model_validate(record) for record in history_records],
        total=len(history_records)
    )


@router.delete("/history")
async def clear_sensor_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    keep_hours: int = Query(default=0, ge=0, description="Giữ lại dữ liệu trong N giờ gần nhất (0 = xóa hết)")
):
    """Xóa lịch sử cảm biến (admin only)"""
    if keep_hours > 0:
        cutoff_time = datetime.utcnow() - timedelta(hours=keep_hours)
        deleted = db.query(SensorHistory).filter(SensorHistory.timestamp < cutoff_time).delete()
    else:
        deleted = db.query(SensorHistory).delete()
    
    db.commit()
    return {"status": "success", "deleted_records": deleted}


# ============ USER SETTINGS ENDPOINTS ============

@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy cài đặt ngưỡng tự động của người dùng"""
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(
            id=1,
            light_threshold_low=300,
            light_threshold_high=700,
            auto_brightness=80
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/settings", response_model=UserSettingsResponse)
async def update_settings(
    update_data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cập nhật cài đặt ngưỡng tự động.
    - light_threshold_low: Ngưỡng tối (dưới mức này bật đèn tự động)
    - light_threshold_high: Ngưỡng sáng (trên mức này tắt đèn tự động)
    - auto_brightness: Độ sáng khi bật đèn tự động (0-100)
    """
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(id=1)
        db.add(settings)
    
    # Validate và cập nhật
    if update_data.light_threshold_low is not None:
        if update_data.light_threshold_low < 0:
            raise HTTPException(status_code=400, detail="light_threshold_low must be >= 0")
        settings.light_threshold_low = update_data.light_threshold_low
    
    if update_data.light_threshold_high is not None:
        if update_data.light_threshold_high < 0:
            raise HTTPException(status_code=400, detail="light_threshold_high must be >= 0")
        settings.light_threshold_high = update_data.light_threshold_high
    
    if update_data.auto_brightness is not None:
        if not 0 <= update_data.auto_brightness <= 100:
            raise HTTPException(status_code=400, detail="auto_brightness must be between 0 and 100")
        settings.auto_brightness = update_data.auto_brightness
    
    # Validate: threshold_low < threshold_high
    if settings.light_threshold_low >= settings.light_threshold_high:
        raise HTTPException(
            status_code=400, 
            detail="light_threshold_low must be less than light_threshold_high"
        )
    
    settings.last_updated = datetime.utcnow()
    db.commit()
    db.refresh(settings)
    
    return settings


# ============ DASHBOARD ENDPOINT ============

@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy tổng quan dashboard: trạng thái + cài đặt + số lượng history"""
    # Device status
    device = db.query(DeviceState).first()
    if not device:
        device = DeviceState(id=1, is_on=False, brightness=0, is_auto_mode=False)
        db.add(device)
        db.commit()
        db.refresh(device)
    
    # Settings
    settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
    if not settings:
        settings = UserSettings(id=1, light_threshold_low=300, light_threshold_high=700, auto_brightness=80)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # History count (last 24h)
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
