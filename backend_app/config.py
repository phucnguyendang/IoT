import os

class Settings:
    SECRET_KEY = "your-secret-key-keep-it-secret" # In production, use env var
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    
    # Database
    DATABASE_URL = "sqlite:///./smartlight.db"
    
    # MQTT
    MQTT_BROKER = "w187ffa1.ala.eu-central-1.emqxsl.com"
    MQTT_PORT = 8883
    MQTT_USERNAME = "phucnd"
    MQTT_PASSWORD = "phucnd"
    MQTT_TOPIC_COMMAND = "iot/light/command"
    MQTT_TOPIC_STATUS = "iot/light/status"
    MQTT_CLIENT_ID = "fastapi_server_client"

settings = Settings()
