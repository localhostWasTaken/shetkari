import dataclasses
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query

from weather.client import WeatherClient
from weather.current import get_current
from weather.forecast import get_forecast
from weather.history import get_history

router = APIRouter()


def _to_dict(obj) -> dict:
    """Recursively convert a dataclass (or nested dataclasses) to a plain dict."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {k: _to_dict(v) for k, v in dataclasses.asdict(obj).items() if k != "raw"}
    if isinstance(obj, list):
        return [_to_dict(i) for i in obj]
    return obj


@router.get("/current")
def current_weather(
    lat: float = Query(..., description="Latitude of the farm"),
    lon: float = Query(..., description="Longitude of the farm"),
    lang: str = Query("en", description="Language code for condition text (e.g. 'hi' for Hindi)"),
) -> dict:
    """Real-time weather conditions at the given coordinates."""
    with WeatherClient() as client:
        result = get_current(client, lat=lat, lon=lon, lang=lang)
    return _to_dict(result)


@router.get("/forecast")
def weather_forecast(
    lat: float = Query(..., description="Latitude of the farm"),
    lon: float = Query(..., description="Longitude of the farm"),
    days: int = Query(3, ge=1, le=14, description="Number of forecast days (1-14)"),
    lang: str = Query("en", description="Language code for condition text"),
    include_alerts: bool = Query(True, description="Include severe weather alerts"),
) -> dict:
    """Multi-day weather forecast with optional severe weather alerts."""
    with WeatherClient() as client:
        result = get_forecast(client, lat=lat, lon=lon, days=days, lang=lang, include_alerts=include_alerts)
    return _to_dict(result)


@router.get("/history")
def weather_history(
    lat: float = Query(..., description="Latitude of the farm"),
    lon: float = Query(..., description="Longitude of the farm"),
    dt: date = Query(..., description="Date to look up (YYYY-MM-DD)"),
    lang: str = Query("en", description="Language code for condition text"),
) -> dict:
    """Observed weather for a specific past date."""
    with WeatherClient() as client:
        result = get_history(client, lat=lat, lon=lon, dt=dt, lang=lang)
    return _to_dict(result)
