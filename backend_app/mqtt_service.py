import paho.mqtt.client as mqtt
import json
from datetime import datetime
from .config import settings
from .database import SessionLocal
from .models.device import DeviceState

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
        try:
            payload = msg.payload.decode()
            print(f"Received message from device: {payload}")
            data = json.loads(payload)
            
            db = SessionLocal()
            try:
                device = db.query(DeviceState).filter(DeviceState.id == 1).first()
                if not device:
                    device = DeviceState(id=1)
                    db.add(device)
                
                if "is_on" in data:
                    device.is_on = data["is_on"]
                if "brightness" in data:
                    device.brightness = data["brightness"]
                if "sensor_value" in data:
                    device.sensor_value = data["sensor_value"]
                if "is_auto_mode" in data:
                    device.is_auto_mode = data["is_auto_mode"]
                
                # Cập nhật last_updated từ timestamp của thiết bị (nếu có)
                if "timestamp" in data:
                    try:
                        # Giả sử timestamp là Unix timestamp (số giây hoặc mili-giây)
                        ts = data["timestamp"]
                        # Nếu là mili-giây thì chia 1000
                        if ts > 10000000000: 
                            ts = ts / 1000
                        device.last_updated = datetime.fromtimestamp(ts)
                    except Exception as e:
                        print(f"Error parsing timestamp: {e}")
                else:
                    # Fallback: Nếu không có timestamp thì dùng giờ server
                    device.last_updated = datetime.utcnow()
                
                db.commit()
                print("Database updated from Device feedback!")
            except Exception as db_err:
                print(f"Database Error: {db_err}")
            finally:
                db.close()
                
        except Exception as e:
            print(f"Error processing MQTT message: {e}")

    def connect(self):
        try:
            self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
            self.client.tls_set() # Enable TLS for port 8883
            self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Could not connect to MQTT Broker: {e}")

    def publish_command(self, payload: dict):
        if not self.connected:
            print("MQTT not connected, attempting to reconnect...")
            # self.connect() # Optional: try reconnect
        
        message = json.dumps(payload)
        self.client.publish(settings.MQTT_TOPIC_COMMAND, message)
        print(f"Published: {message} to {settings.MQTT_TOPIC_COMMAND}")

mqtt_service = MQTTService()
