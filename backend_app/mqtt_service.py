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
                if device.is_auto_mode:
                    self._process_auto_logic(db, device)

            except Exception as db_err:
                print(f"[MQTT] Database Error: {db_err}")
                db.rollback()
            finally:
                db.close()
                
        except Exception as e:
            print(f"[MQTT] Error processing message: {e}")

    def _process_auto_logic(self, db, device: DeviceState):
        """
        Logic tự động:
        - Nếu sensor_value < light_threshold_low VÀ đèn đang tắt → Bật đèn
        - Nếu sensor_value > light_threshold_high VÀ đèn đang bật → Tắt đèn
        """
        try:
            # Lấy cài đặt ngưỡng
            user_settings = db.query(UserSettings).filter(UserSettings.id == 1).first()
            if not user_settings:
                # Tạo cài đặt mặc định nếu chưa có
                user_settings = UserSettings(
                    id=1,
                    light_threshold_low=300,
                    light_threshold_high=700,
                    auto_brightness=80
                )
                db.add(user_settings)
                db.commit()
            
            sensor_value = device.sensor_value
            threshold_low = user_settings.light_threshold_low
            threshold_high = user_settings.light_threshold_high
            auto_brightness = user_settings.auto_brightness

            print(f"[AUTO] Sensor: {sensor_value}, Low: {threshold_low}, High: {threshold_high}, Light is {'ON' if device.is_on else 'OFF'}")

            # Logic: Ánh sáng yếu (sensor thấp) → Bật đèn
            if sensor_value < threshold_low and not device.is_on:
                print(f"[AUTO] Sensor ({sensor_value}) < Threshold Low ({threshold_low}) → Turning ON light!")
                self.publish_command({
                    "type": "MANUAL",
                    "state": "ON",
                    "brightness": auto_brightness
                })
            
            # Logic: Ánh sáng mạnh (sensor cao) → Tắt đèn
            elif sensor_value > threshold_high and device.is_on:
                print(f"[AUTO] Sensor ({sensor_value}) > Threshold High ({threshold_high}) → Turning OFF light!")
                self.publish_command({
                    "type": "MANUAL",
                    "state": "OFF",
                    "brightness": 0
                })
            else:
                print(f"[AUTO] No action needed. Sensor value in normal range or state already correct.")

        except Exception as e:
            print(f"[AUTO] Error in auto logic: {e}")

    def connect(self):
        try:
            self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
            self.client.tls_set()  # Enable TLS for port 8883
            self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"[MQTT] Could not connect to Broker: {e}")

    def publish_command(self, payload: dict):
        if not self.connected:
            print("[MQTT] Not connected, attempting to reconnect...")
        
        message = json.dumps(payload)
        self.client.publish(settings.MQTT_TOPIC_COMMAND, message)
        print(f"[MQTT] Published: {message} to {settings.MQTT_TOPIC_COMMAND}")

mqtt_service = MQTTService()
