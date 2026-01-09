import paho.mqtt.client as mqtt
import json
from datetime import datetime
from .config import settings
from .database import SessionLocal
from .models.device import DeviceState, SensorHistory, UserSettings

class MQTTService:
    def __init__(self):
        self.client = mqtt.Client(client_id=settings.MQTT_CLIENT_ID)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.connected = False

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("Connected to MQTT Broker!")
            self.connected = True
            self.client.subscribe(settings.MQTT_TOPIC_STATUS)
            print(f"Subscribed to {settings.MQTT_TOPIC_STATUS}")
        else:
            print(f"Failed to connect, return code {rc}")

    def on_message(self, client, userdata, msg):
        """
        Xử lý message từ ESP32:
        1. Cập nhật trạng thái thiết bị (device_state)
        2. Lưu lịch sử cảm biến (sensor_history)
        3. Xử lý logic tự động (nếu is_auto_mode = True)
        """
        try:
            payload = msg.payload.decode()
            print(f"[MQTT] Received message from device: {payload}")
            data = json.loads(payload)
            
            db = SessionLocal()
            try:
                # === 1. Cập nhật trạng thái thiết bị ===
                device = db.query(DeviceState).filter(DeviceState.id == 1).first()
                if not device:
                    device = DeviceState(id=1)
                    db.add(device)

                # Lưu giá trị cũ để so sánh
                old_is_on = device.is_on
                old_is_auto = device.is_auto_mode
                
                if "is_on" in data:
                    device.is_on = data["is_on"]
                if "brightness" in data:
                    device.brightness = data["brightness"]
                if "sensor_value" in data:
                    device.sensor_value = data["sensor_value"]
                if "is_auto_mode" in data:
                    device.is_auto_mode = data["is_auto_mode"]
                
                # Xử lý timestamp
                record_time = datetime.utcnow()
                if "timestamp" in data:
                    try:
                        ts = data["timestamp"]
                        if ts > 10000000000:
                            ts = ts / 1000
                        record_time = datetime.fromtimestamp(ts)
                    except Exception as e:
                        print(f"[MQTT] Error parsing timestamp: {e}")
                
                device.last_updated = record_time
                db.commit()
                print("[MQTT] Device state updated!")

                # === 2. Lưu lịch sử cảm biến ===
                history = SensorHistory(
                    sensor_value=device.sensor_value,
                    brightness=device.brightness,
                    is_on=device.is_on,
                    is_auto_mode=device.is_auto_mode,
                    timestamp=record_time
                )
                db.add(history)
                db.commit()
                print("[MQTT] Sensor history saved!")

                # === 3. Xử lý logic tự động trên Backend ===
                # Chỉ xử lý nếu đang ở chế độ AUTO
                # if device.is_auto_mode:
                #     self._process_auto_logic(db, device)

            except Exception as db_err:
                print(f"[MQTT] Database Error: {db_err}")
                db.rollback()
            finally:
                db.close()
                
        except Exception as e:
            print(f"[MQTT] Error processing message: {e}")

    def _process_auto_logic(self, db, device: DeviceState):
        """
        LOGIC TỰ ĐỘNG (SỬA ĐỔI):
        - Server đóng vai trò "Giám sát viên".
        - Sensor thấp (Trời sáng) -> Server ra lệnh TẮT HẲN.
        - Sensor cao (Trời tối) -> Server ra lệnh BẬT CHẾ ĐỘ AUTO (để ESP32 tự dimming).
        """
        try:
            # 1. Lấy cài đặt ngưỡng từ Database
            user_settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
            if not user_settings:
                # Tạo mặc định nếu chưa có (Dựa trên log thực tế của bạn: 28 là sáng, 1400 là tối)
                user_settings = UserSettings(
                    id=1,
                    light_threshold_low=300,    # Dưới 300 là SÁNG QUÁ -> Cần tắt đèn
                    light_threshold_high=1200,  # Trên 1200 là TỐI -> Cần bật Auto
                    auto_brightness=80          
                )
                db.add(user_settings)
                db.commit()
            
        
            sensor_value = device.sensor_value
            threshold_turn_off = user_settings.light_threshold_low   # Ngưỡng sáng (để tắt)
            threshold_turn_on = user_settings.light_threshold_high   # Ngưỡng tối (để bật Auto)

            print(f"[AUTO CHECK] Sensor: {sensor_value} | Tắt nếu < {threshold_turn_off} | Bật Auto nếu > {threshold_turn_on}")

            # === TRƯỜNG HỢP 1: TRỜI SÁNG -> TẮT ĐÈN ===
            # Điều kiện: (Sensor nhỏ hơn ngưỡng thấp) VÀ (Đèn đang bật)
            if sensor_value < threshold_turn_off and device.is_on:
                print(f"☀️ [AUTO] Trời sáng (Sensor {sensor_value} < {threshold_turn_off}) -> Gửi lệnh TẮT ĐÈN.")
                self.publish_command({
                    "type": "MANUAL",
                    "state": "OFF",
                    "brightness": 0
                })
            
            # === TRƯỜNG HỢP 2: TRỜI TỐI -> BẬT CHẾ ĐỘ AUTO ===
            # Điều kiện: (Sensor lớn hơn ngưỡng cao) VÀ (Đèn đang tắt HOẶC Đang không ở chế độ Auto)
            # Nếu đèn đang sáng và đang ở Auto rồi thì cứ để ESP32 tự chỉnh, Server không cần can thiệp nữa.
            elif sensor_value > threshold_turn_on and (not device.is_on or not device.is_auto_mode):
                print(f"🌙 [AUTO] Trời tối (Sensor {sensor_value} > {threshold_turn_on}) -> Kích hoạt ESP32 AUTO MODE.")
                
                # Gửi lệnh kích hoạt chế độ Auto cho ESP32
                # ESP32 sẽ tự tính toán map(sensor) ra độ sáng phù hợp
                self.publish_command({
                    "type": "AUTO",
                    "enable": True
                })

            # === TRƯỜNG HỢP 3: VÙNG GIỮA (HYSTERESIS) ===
            else:
                print(f"⚖️ [AUTO] Giữ nguyên trạng thái (Sensor nằm trong vùng đệm hoặc trạng thái đã đúng).")

        except Exception as e:
            print(f"❌ [AUTO] Lỗi logic tự động: {e}")

    def connect(self):
        try:
           
            if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
                self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
            

            
            # Kết nối vào Broker
            self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
            self.client.loop_start()
            print(f"✅ [MQTT] Connected to {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
            
        except Exception as e:
            print(f"❌ [MQTT] Could not connect to Broker: {e}")

    def publish_command(self, payload: dict):
        if not self.connected:
            print("[MQTT] Not connected, attempting to reconnect...")
        
        message = json.dumps(payload)
        self.client.publish(settings.MQTT_TOPIC_COMMAND, message)
        print(f"[MQTT] Published: {message} to {settings.MQTT_TOPIC_COMMAND}")

mqtt_service = MQTTService()
