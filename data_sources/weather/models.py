"""
Typed dataclasses for all WeatherAPI responses.

Each model exposes only the fields relevant to farming use-cases while
also carrying the full raw API payload (`raw`) for any downstream logic
that needs additional fields.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

@dataclass
class Location:
    name: str
    region: str
    country: str
    lat: float
    lon: float
    localtime: str


# ---------------------------------------------------------------------------
# Forecast models
# ---------------------------------------------------------------------------

@dataclass
class ForecastDay:
    date: str
    max_temp_c: float
    min_temp_c: float
    avg_temp_c: float
    max_wind_kph: float
    total_precip_mm: float
    daily_chance_of_rain: int        # 0-100 %  ← key irrigation decision input
    daily_chance_of_snow: int        # 0-100 %
    avg_humidity: float
    condition_text: str              # localised via `lang=` param
    uv_index: float
    sunrise: str
    sunset: str


@dataclass
class WeatherAlert:
    headline: str
    severity: str                    # e.g. "Moderate", "Extreme"
    urgency: str
    areas: str
    event: str
    effective: str
    expires: str
    description: str
    instruction: str


@dataclass
class ForecastResponse:
    location: Location
    forecast_days: list[ForecastDay]
    alerts: list[WeatherAlert]
    raw: dict[str, Any] = field(repr=False)  # full API payload


# ---------------------------------------------------------------------------
# Current weather models
# ---------------------------------------------------------------------------

@dataclass
class CurrentWeather:
    temp_c: float
    feels_like_c: float
    humidity: int                    # % — high humidity + heat → fungal risk
    wind_kph: float
    wind_dir: str                    # e.g. "NE" — for pesticide spray decisions
    wind_degree: int
    cloud: int                       # cloud cover %
    precip_mm: float                 # precipitation so far today
    vis_km: float
    uv_index: float
    condition_text: str              # localised
    is_day: bool
    last_updated: str


@dataclass
class CurrentResponse:
    location: Location
    current: CurrentWeather
    raw: dict[str, Any] = field(repr=False)


# ---------------------------------------------------------------------------
# History models
# ---------------------------------------------------------------------------

@dataclass
class HistoryDay:
    date: str
    max_temp_c: float
    min_temp_c: float
    avg_temp_c: float
    total_precip_mm: float           # how much rain actually fell — soil moisture proxy
    avg_humidity: float
    max_wind_kph: float
    condition_text: str
    sunrise: str
    sunset: str


@dataclass
class HistoryResponse:
    location: Location
    history_days: list[HistoryDay]
    raw: dict[str, Any] = field(repr=False)
