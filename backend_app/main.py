from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, control
from .database import engine, Base
from .mqtt_service import mqtt_service

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="IoT Smart Light Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(control.router)

@app.on_event("startup")
async def startup_event():
    mqtt_service.connect()

@app.get("/")
async def root():
    return {"message": "Welcome to IoT Smart Light API"}
