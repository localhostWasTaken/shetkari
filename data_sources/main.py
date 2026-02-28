"""
data_sources — FastAPI server
==============================
Run with:
    uvicorn main:app --reload

Endpoints
---------
POST /soil-health          → fetch soil health card data for an Indian phone number
GET  /weather/current      → real-time weather at given coordinates
GET  /weather/forecast     → multi-day forecast with optional alerts
GET  /weather/history      → observed weather for a past date
"""

from fastapi import FastAPI
from routers import mandi, soil_health, weather

app = FastAPI(
    title="AfterMath Data Sources",
    description="Soil health, weather, and mandi price data for Indian farm advisory.",
    version="1.0.0",
)

app.include_router(soil_health.router, prefix="/soil-health", tags=["Soil Health"])
app.include_router(weather.router, prefix="/weather", tags=["Weather"])
app.include_router(mandi.router, prefix="/mandi", tags=["Mandi"])
