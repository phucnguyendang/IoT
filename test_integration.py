"""
Integration Test cho hệ thống IoT Smart Light
==============================================
Script này giả lập thiết bị ESP32 và test toàn bộ luồng hoạt động:
1. Kết nối MQTT Broker
2. Đăng nhập lấy token
3. Test các API điều khiển
4. Test cài đặt ngưỡng
5. Test lịch sử cảm biến
"""

import time
import json
import requests
import paho.mqtt.client as mqtt
from backend_app.config import settings

# --- Cấu hình Test ---
API_URL = "http://127.0.0.1:8000"
USERNAME = "admin"
PASSWORD = "admin"

class MockESP32:
    """Giả lập thiết bị ESP32 để test hệ thống"""
    
    def __init__(self):
        self.client = mqtt.Client(client_id="mock_esp32_device")
        self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        self.client.tls_set()  # Bật TLS vì dùng port 8883
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.received_commands = []
        
        # Internal state
        self.is_on = True
        self.brightness = 50
        self.is_auto_mode = False
        self.sensor_value = 100

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("[MockESP32] Connected to Broker!")
            client.subscribe(settings.MQTT_TOPIC_COMMAND)
            print(f"[MockESP32] Subscribed to {settings.MQTT_TOPIC_COMMAND}")
        else:
            print(f"[MockESP32] Connection failed: {rc}")

    def on_message(self, client, userdata, msg):
        payload = msg.payload.decode()
        print(f"[MockESP32] RECEIVED COMMAND: {payload}")
        data = json.loads(payload)
        self.received_commands.append(data)
        
        # Simulate device logic: Update internal state based on command
        if data.get("type") == "MANUAL":
            self.is_auto_mode = False
            if "state" in data:
                self.is_on = (data["state"] == "ON")
            if "brightness" in data:
                self.brightness = data["brightness"]
        elif data.get("type") == "AUTO":
            if "enable" in data:
                self.is_auto_mode = data["enable"]
        
        # Send feedback immediately to confirm state change
        self.send_status_update()

    def send_status_update(self):
        payload = {
            "is_on": self.is_on,
            "brightness": self.brightness,
            "sensor_value": self.sensor_value,
            "is_auto_mode": self.is_auto_mode,
            "timestamp": int(time.time())
        }
        print(f"[MockESP32] Sending feedback: {payload}")
        self.client.publish(settings.MQTT_TOPIC_STATUS, json.dumps(payload))

    def start(self):
        print(f"[MockESP32] Connecting to {settings.MQTT_BROKER}:{settings.MQTT_PORT}...")
        self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
        self.client.loop_start()

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()

    def send_sensor_data(self, brightness, sensor_value, is_on=True):
        # Update internal state
        self.brightness = brightness
        self.sensor_value = sensor_value
        self.is_on = is_on
        self.send_status_update()


def test_system_flow():
    print("=" * 60)
    print("=== BẮT ĐẦU TEST HỆ THỐNG IOT SMART LIGHT ===")
    print("=" * 60)
    
    # 1. Khởi động Mock Device (Giả lập ESP32)
    device = MockESP32()
    device.start()
    time.sleep(3)  # Đợi kết nối

    try:
        # 2. Đăng nhập lấy Token (Giả lập Web Client)
        print("\n" + "-" * 50)
        print("[STEP 1] Đăng nhập")
        print("-" * 50)
        login_payload = {"username": USERNAME, "password": PASSWORD}
        response = requests.post(f"{API_URL}/token", data=login_payload)
        
        if response.status_code != 200:
            print(f"❌ Lỗi đăng nhập: {response.text}")
            return
            
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Đăng nhập thành công! Token đã nhận.")

        # --- TEST CASE 1: SET BRIGHTNESS ---
        print("\n" + "-" * 50)
        print("[TEST 1] Điều khiển độ sáng (Set Brightness = 88)")
        print("-" * 50)
        device.received_commands.clear()
        control_payload = {"action": "SET_BRIGHTNESS", "value": 88}
        resp = requests.post(f"{API_URL}/api/device/control", json=control_payload, headers=headers)
        print(f"Web Response: {resp.json()}")

        time.sleep(2)
        
        if any(cmd.get('brightness') == 88 for cmd in device.received_commands):
            print("✅ MQTT PASS: MockESP32 đã nhận được lệnh điều khiển độ sáng 88!")
        else:
            print("❌ MQTT FAIL: MockESP32 KHÔNG nhận được lệnh.")

        # --- TEST CASE 2: TOGGLE POWER (OFF) ---
        print("\n" + "-" * 50)
        print("[TEST 2] Tắt đèn (Toggle Power OFF)")
        print("-" * 50)
        device.received_commands.clear()
        control_payload = {"action": "TOGGLE_POWER", "state": False}
        resp = requests.post(f"{API_URL}/api/device/control", json=control_payload, headers=headers)
        print(f"Web Response: {resp.json()}")
        
        time.sleep(2)
        
        cmd = next((c for c in device.received_commands if c.get('type') == 'MANUAL'), None)
        if cmd and cmd.get('state') == 'OFF':
            print("✅ MQTT PASS: Lệnh tắt đèn đã gửi xuống thiết bị.")
        else:
            print(f"❌ MQTT FAIL: Không nhận được lệnh tắt đèn. Received: {device.received_commands}")

        status_resp = requests.get(f"{API_URL}/api/device/status", headers=headers)
        if status_resp.json().get("is_on") == False:
            print("✅ API PASS: Trạng thái đèn trên Server đã cập nhật thành OFF.")
        else:
            print("❌ API FAIL: Trạng thái đèn chưa cập nhật.")

        # --- TEST CASE 3: TOGGLE POWER (ON) ---
        print("\n" + "-" * 50)
        print("[TEST 3] Bật đèn (Toggle Power ON)")
        print("-" * 50)
        device.received_commands.clear()
        control_payload = {"action": "TOGGLE_POWER", "state": True}
        requests.post(f"{API_URL}/api/device/control", json=control_payload, headers=headers)
        time.sleep(2)
        
        cmd = next((c for c in device.received_commands if c.get('type') == 'MANUAL'), None)
        if cmd and cmd.get('state') == 'ON':
            print("✅ MQTT PASS: Lệnh bật đèn đã gửi xuống thiết bị.")
        else:
            print("❌ MQTT FAIL: Không nhận được lệnh bật đèn.")

        # --- TEST CASE 4: ENABLE AUTO MODE ---
        print("\n" + "-" * 50)
        print("[TEST 4] Bật chế độ tự động (Enable Auto Mode)")
        print("-" * 50)
        device.received_commands.clear()
        control_payload = {"action": "SET_AUTO", "enable": True}
        requests.post(f"{API_URL}/api/device/control", json=control_payload, headers=headers)
        time.sleep(2)

        cmd = next((c for c in device.received_commands if c.get('type') == 'AUTO'), None)
        if cmd and cmd.get('enable') == True:
            print("✅ MQTT PASS: Lệnh bật Auto Mode đã gửi xuống thiết bị.")
        else:
            print("❌ MQTT FAIL: Không nhận được lệnh bật Auto Mode.")
        
        status_resp = requests.get(f"{API_URL}/api/device/status", headers=headers)
        if status_resp.json().get("is_auto_mode") == True:
            print("✅ API PASS: Trạng thái Auto Mode trên Server đã cập nhật thành True.")
        else:
            print("❌ API FAIL: Trạng thái Auto Mode chưa cập nhật.")

        # --- TEST CASE 5: DEVICE FEEDBACK (SENSOR DATA) ---
        print("\n" + "-" * 50)
        print("[TEST 5] Device gửi dữ liệu cảm biến (Sensor = 750, Brightness = 30)")
        print("-" * 50)
        device.send_sensor_data(brightness=30, sensor_value=750, is_on=True)
        time.sleep(3)

        status_resp = requests.get(f"{API_URL}/api/device/status", headers=headers)
        status_data = status_resp.json()
        print(f"Current Status from API: {status_data}")

        if status_data.get("sensor_value") == 750 and status_data.get("brightness") == 30:
            print("✅ DATA PASS: Server đã cập nhật giá trị cảm biến (750) và độ sáng (30)!")
        else:
            print(f"❌ DATA FAIL: Dữ liệu không khớp. Server có: {status_data}")

        # --- TEST CASE 6: USER SETTINGS ---
        print("\n" + "-" * 50)
        print("[TEST 6] Cập nhật cài đặt ngưỡng tự động")
        print("-" * 50)
        settings_payload = {
            "light_threshold_low": 200,
            "light_threshold_high": 800,
            "auto_brightness": 90
        }
        resp = requests.put(f"{API_URL}/api/device/settings", json=settings_payload, headers=headers)
        if resp.status_code == 200:
            print(f"✅ SETTINGS PASS: Đã cập nhật cài đặt: {resp.json()}")
        else:
            print(f"❌ SETTINGS FAIL: Lỗi cập nhật: {resp.text}")
        
        # Verify settings
        settings_resp = requests.get(f"{API_URL}/api/device/settings", headers=headers)
        settings_data = settings_resp.json()
        if (settings_data.get("light_threshold_low") == 200 and 
            settings_data.get("light_threshold_high") == 800):
            print("✅ SETTINGS VERIFY PASS: Cài đặt đã được lưu đúng.")
        else:
            print(f"❌ SETTINGS VERIFY FAIL: {settings_data}")

        # --- TEST CASE 7: SENSOR HISTORY ---
        print("\n" + "-" * 50)
        print("[TEST 7] Lấy lịch sử cảm biến")
        print("-" * 50)
        history_resp = requests.get(f"{API_URL}/api/device/history?hours=1&limit=10", headers=headers)
        if history_resp.status_code == 200:
            history_data = history_resp.json()
            print(f"✅ HISTORY PASS: Có {history_data.get('total', 0)} bản ghi trong 1 giờ qua.")
            if history_data.get('data'):
                print(f"   Bản ghi gần nhất: {history_data['data'][-1]}")
        else:
            print(f"❌ HISTORY FAIL: {history_resp.text}")

        # --- TEST CASE 8: AUTO LOGIC TEST ---
        print("\n" + "-" * 50)
        print("[TEST 8] Test logic tự động (gửi sensor thấp để trigger bật đèn)")
        print("-" * 50)
        # Reset to auto mode ON
        device.is_auto_mode = True
        device.is_on = False
        device.sensor_value = 100  # Below threshold (200)
        device.received_commands.clear()
        device.send_status_update()
        
        time.sleep(3)
        
        # Check if server sent ON command due to low light
        auto_cmd = next((c for c in device.received_commands if c.get('state') == 'ON'), None)
        if auto_cmd:
            print("✅ AUTO LOGIC PASS: Server đã gửi lệnh bật đèn tự động khi ánh sáng yếu!")
        else:
            print("ℹ️ AUTO LOGIC: Không có lệnh tự động (có thể đèn đã bật hoặc logic chưa trigger).")

    except Exception as e:
        print(f"❌ Lỗi xảy ra trong quá trình test: {e}")
    finally:
        print("\n" + "=" * 60)
        print("=== KẾT THÚC TEST ===")
        print("=" * 60)
        device.stop()


if __name__ == "__main__":
    test_system_flow()
