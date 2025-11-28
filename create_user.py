"""
Script tạo user admin và khởi tạo cài đặt mặc định cho hệ thống IoT Smart Light
"""
from backend_app.database import SessionLocal, engine, Base
from backend_app.models.device import User, DeviceState, UserSettings
from backend_app.routers.auth import get_password_hash

def create_user(username, password):
    """Tạo user mới với username và password"""
    db = SessionLocal()
    try:
        # Check if user exists
        user = db.query(User).filter(User.username == username).first()
        if user:
            print(f"⚠️  User '{username}' đã tồn tại.")
            return False

        hashed_password = get_password_hash(password)
        new_user = User(username=username, hashed_password=hashed_password)
        db.add(new_user)
        db.commit()
        print(f"✅ User '{username}' đã được tạo thành công.")
        return True
    finally:
        db.close()

def init_device_state():
    """Khởi tạo trạng thái thiết bị mặc định"""
    db = SessionLocal()
    try:
        device = db.query(DeviceState).filter(DeviceState.id == 1).first()
        if not device:
            device = DeviceState(
                id=1,
                is_on=False,
                brightness=0,
                sensor_value=0,
                is_auto_mode=False
            )
            db.add(device)
            db.commit()
            print("✅ Đã khởi tạo trạng thái thiết bị mặc định.")
        else:
            print("⚠️  Trạng thái thiết bị đã tồn tại.")
    finally:
        db.close()

def init_user_settings():
    """Khởi tạo cài đặt người dùng mặc định"""
    db = SessionLocal()
    try:
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
            print("✅ Đã khởi tạo cài đặt ngưỡng mặc định.")
            print(f"   - Ngưỡng tối (bật đèn): {settings.light_threshold_low}")
            print(f"   - Ngưỡng sáng (tắt đèn): {settings.light_threshold_high}")
            print(f"   - Độ sáng tự động: {settings.auto_brightness}%")
        else:
            print("⚠️  Cài đặt người dùng đã tồn tại.")
    finally:
        db.close()

def main():
    print("=" * 50)
    print("🚀 KHỞI TẠO HỆ THỐNG IoT SMART LIGHT")
    print("=" * 50)
    
    # Create all tables
    print("\n📦 Tạo database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables đã sẵn sàng.")
    
    # Create admin user
    print("\n👤 Tạo user admin...")
    create_user("admin", "admin")
    
    # Initialize device state
    print("\n💡 Khởi tạo trạng thái thiết bị...")
    init_device_state()
    
    # Initialize user settings
    print("\n⚙️  Khởi tạo cài đặt người dùng...")
    init_user_settings()
    
    print("\n" + "=" * 50)
    print("✅ HOÀN TẤT KHỞI TẠO!")
    print("=" * 50)
    print("\n📌 Thông tin đăng nhập:")
    print("   Username: admin")
    print("   Password: admin")
    print("\n🌐 Chạy server: uvicorn backend_app.main:app --reload")
    print("📖 API Docs: http://127.0.0.1:8000/docs")
    print("🖥️  Frontend: http://127.0.0.1:8000/")

if __name__ == "__main__":
    main()
