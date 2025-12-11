from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from .routers import auth, control
from .database import engine, Base
from .mqtt_service import mqtt_service

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="IoT Smart Light Backend",
    description="API Backend cho hệ thống điều khiển đèn thông minh IoT",
    version="1.0.0"
)

# CORS - Allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(control.router)

# Frontend path
frontend_path = Path(__file__).parent.parent / "frontend"

@app.on_event("startup")
async def startup_event():
    """Khởi động kết nối MQTT khi server start"""
    mqtt_service.connect()
    print("=" * 50)
    print("🚀 IoT Smart Light Backend đã khởi động!")
    print("=" * 50)

# Serve frontend static files
@app.get("/", tags=["frontend"])
async def serve_index():
    """Serve trang chính"""
    return FileResponse(str(frontend_path / "index.html"))

@app.get("/styles.css", tags=["frontend"])
async def serve_css():
    """Serve CSS file"""
    return FileResponse(str(frontend_path / "styles.css"), media_type="text/css")

@app.get("/app.js", tags=["frontend"])
async def serve_js():
    """Serve JavaScript file"""
    return FileResponse(str(frontend_path / "app.js"), media_type="application/javascript")

@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mqtt_connected": mqtt_service.connected
    }
