"""
Input Pydantic models for the AI Farm Analyst.

These models represent the three data sources that feed the LLM:
  - SoilData     : nutrient levels, pH, moisture
  - WeatherData  : current conditions + 7-day forecast
  - CropPlan     : what the farmer is growing and how
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field
from typing import Literal

class AnalyseRequest(BaseModel):
    """Payload for the /analyse endpoint."""
    expected_language: str = Field(
        default="English",
        description="Language for the final report. The AI should respond in this language and its matching script."
    )
    soil: SoilData
    weather: WeatherData
    crop: CropPlan


class SoilData(BaseModel):
    """Soil health snapshot for the farm."""

    nitrogen_status: Literal["Deficient", "Normal", "Excess"] = Field(
        description="Nitrogen level relative to crop requirement."
    )
    phosphorus_status: Literal["Deficient", "Normal", "Excess"] = Field(
        description="Phosphorus level relative to crop requirement."
    )
    potassium_status: Literal["Deficient", "Normal", "Excess"] = Field(
        description="Potassium level relative to crop requirement."
    )
    ph_level: float = Field(
        ge=0.0,
        le=14.0,
        description="Soil pH value between 0 and 14.",
    )
    organic_matter: Literal["Low", "Medium", "High"] = Field(
        default="Medium",
        description="Organic matter content of the soil.",
    )
    soil_moisture_percent: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Current volumetric soil moisture percentage (0-100). Optional.",
    )


class WeatherForecast(BaseModel):
    """Weather forecast for a single day."""

    day_offset: int = Field(
        description="Days from today. 0 = today, 1 = tomorrow, etc."
    )
    condition: str = Field(
        description="Human-readable weather condition, e.g. 'Heavy Rain', 'Clear', 'Partly Cloudy'."
    )
    rain_probability_percent: float = Field(
        ge=0.0,
        le=100.0,
        description="Probability of rainfall as a percentage.",
    )
    temperature_celsius: float = Field(
        description="Forecast temperature in Celsius."
    )
    humidity_percent: float = Field(
        ge=0.0,
        le=100.0,
        description="Forecast relative humidity as a percentage.",
    )
    rainfall_mm: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Expected rainfall amount in millimetres. Optional.",
    )


class WeatherData(BaseModel):
    """Current weather conditions and short-range forecast."""

    current_temperature_celsius: float = Field(
        description="Current temperature at the farm location in Celsius."
    )
    current_humidity_percent: float = Field(
        ge=0.0,
        le=100.0,
        description="Current relative humidity as a percentage.",
    )
    current_condition: str = Field(
        description="Current weather condition, e.g. 'Clear', 'Overcast'."
    )
    current_wind_kmh: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Current wind speed in km/h. Optional.",
    )
    forecast: List[WeatherForecast] = Field(
        description="Day-by-day forecast list (typically 7 days)."
    )


class CropPlan(BaseModel):
    """Farmer's active crop plan for a specific field."""

    crop_name: str = Field(
        description="Common name of the crop, e.g. 'Maize', 'Tomato', 'Ragi'."
    )
    variety: Optional[str] = Field(
        default=None,
        description="Specific variety or hybrid name, e.g. 'Bt Cotton', 'Hybrid 30'. Optional.",
    )
    sowing_date: date = Field(
        description="Date when the crop was (or will be) sown. ISO 8601 format."
    )
    farm_size_acres: float = Field(
        gt=0.0,
        description="Size of the field where this crop is planted, in acres.",
    )
    irrigation_type: Literal["Rainfed", "Borewell", "Canal", "Drip", "Sprinkler"] = Field(
        description="Primary water source for this field."
    )
    notes: Optional[str] = Field(
        default=None,
        description="Any extra context the farmer wants to share, e.g. recent pest sighting.",
    )
