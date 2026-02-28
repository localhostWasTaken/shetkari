"""
weather — WeatherAPI client package
=====================================

Three focused functions, one client, zero boilerplate.

Quick start
-----------
    from weather import WeatherClient, get_forecast, get_current, get_history

    with WeatherClient(api_key="YOUR_KEY") as client:
        forecast  = get_forecast(client, lat=13.0614, lon=78.3341, days=3, lang="hi")
        current   = get_current(client,  lat=13.0614, lon=78.3341, lang="hi")
        history   = get_history(client,  lat=13.0614, lon=78.3341, dt="2026-02-28")

Or set the WEATHERAPI_KEY environment variable and omit api_key=:
    export WEATHERAPI_KEY="YOUR_KEY"
"""

from weather.client import WeatherAPIError, WeatherClient
from weather.current import get_current
from weather.forecast import get_forecast
from weather.history import get_history
from weather.models import (
    CurrentResponse,
    CurrentWeather,
    ForecastDay,
    ForecastResponse,
    HistoryDay,
    HistoryResponse,
    Location,
    WeatherAlert,
)

__all__ = [
    # Client
    "WeatherClient",
    "WeatherAPIError",
    # Endpoint functions
    "get_forecast",
    "get_current",
    "get_history",
    # Response models
    "ForecastResponse",
    "ForecastDay",
    "WeatherAlert",
    "CurrentResponse",
    "CurrentWeather",
    "HistoryResponse",
    "HistoryDay",
    "Location",
]
