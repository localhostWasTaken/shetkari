"""
Forecast API  →  GET /v1/forecast.json
https://www.weatherapi.com/docs/#apis-forecast

Returns current weather + up to 14 days of hourly/daily forecasts and,
optionally, severe weather alerts issued by government agencies.

This is the primary endpoint for farm planning decisions:
  - Rainfall probability    → irrigation scheduling
  - Total precipitation mm  → sowing / harvesting timing
  - Max/min temperature     → crop heat-stress monitoring
  - Max wind speed          → tall-crop damage risk (sugarcane, maize)
  - Severe weather alerts   → flood / heatwave early warnings
"""

from __future__ import annotations

from weather.client import WeatherClient
from weather.models import (
    ForecastDay,
    ForecastResponse,
    Location,
    WeatherAlert,
)


def get_forecast(
    client: WeatherClient,
    lat: float,
    lon: float,
    days: int = 3,
    lang: str = "en",
    include_alerts: bool = True,
    include_aqi: bool = False,
) -> ForecastResponse:
    """
    Fetch a multi-day weather forecast for the given coordinates.

    Parameters
    ----------
    client:
        An initialised :class:`~weather.client.WeatherClient` instance.
    lat, lon:
        GPS coordinates of the farm (from WhatsApp location share).
    days:
        Number of forecast days to return (1–14).  Defaults to 3.
    lang:
        Language code for condition text.  Use ``"hi"`` for Hindi,
        ``"en"`` for English.  Full list at weatherapi.com/docs.
    include_alerts:
        When ``True`` (default) severe weather alerts are included in
        the response.  Strongly recommended for farming use-cases.
    include_aqi:
        Include air quality data in the current-day block (default off).

    Returns
    -------
    ForecastResponse
        Structured object with ``location``, ``forecast_days`` (list of
        :class:`~weather.models.ForecastDay`), ``alerts`` (list of
        :class:`~weather.models.WeatherAlert`) and ``raw`` (full JSON
        payload).

    Example
    -------
    >>> from weather.client import WeatherClient
    >>> from weather.forecast import get_forecast
    >>>
    >>> with WeatherClient(api_key="YOUR_KEY") as client:
    ...     result = get_forecast(client, lat=13.0614, lon=78.3341, days=3, lang="hi")
    ...     for day in result.forecast_days:
    ...         print(day.date, day.daily_chance_of_rain, "%", day.total_precip_mm, "mm")
    ...     for alert in result.alerts:
    ...         print("⚠️ ", alert.headline)
    """
    params: dict = {
        "q": f"{lat},{lon}",
        "days": max(1, min(days, 14)),
        "aqi": "yes" if include_aqi else "no",
        "alerts": "yes" if include_alerts else "no",
        "lang": lang,
    }

    raw = client._get("forecast.json", params)

    location = _parse_location(raw["location"])
    forecast_days = [_parse_forecast_day(fd) for fd in raw["forecast"]["forecastday"]]
    alerts = _parse_alerts(raw.get("alerts", {}).get("alert", []))

    return ForecastResponse(
        location=location,
        forecast_days=forecast_days,
        alerts=alerts,
        raw=raw,
    )


# ---------------------------------------------------------------------------
# Private parsers
# ---------------------------------------------------------------------------

def _parse_location(loc: dict) -> Location:
    return Location(
        name=loc["name"],
        region=loc["region"],
        country=loc["country"],
        lat=loc["lat"],
        lon=loc["lon"],
        localtime=loc["localtime"],
    )


def _parse_forecast_day(fd: dict) -> ForecastDay:
    day = fd["day"]
    astro = fd.get("astro", {})
    return ForecastDay(
        date=fd["date"],
        max_temp_c=day["maxtemp_c"],
        min_temp_c=day["mintemp_c"],
        avg_temp_c=day["avgtemp_c"],
        max_wind_kph=day["maxwind_kph"],
        total_precip_mm=day["totalprecip_mm"],
        daily_chance_of_rain=int(day.get("daily_chance_of_rain", 0)),
        daily_chance_of_snow=int(day.get("daily_chance_of_snow", 0)),
        avg_humidity=day["avghumidity"],
        condition_text=day["condition"]["text"],
        uv_index=day["uv"],
        sunrise=astro.get("sunrise", ""),
        sunset=astro.get("sunset", ""),
    )


def _parse_alerts(alert_list: list) -> list[WeatherAlert]:
    result = []
    for a in alert_list:
        result.append(
            WeatherAlert(
                headline=a.get("headline", ""),
                severity=a.get("severity", ""),
                urgency=a.get("urgency", ""),
                areas=a.get("areas", ""),
                event=a.get("event", ""),
                effective=a.get("effective", ""),
                expires=a.get("expires", ""),
                description=a.get("desc", ""),
                instruction=a.get("instruction", ""),
            )
        )
    return result
