"""
Realtime / Current Weather API  →  GET /v1/current.json
https://www.weatherapi.com/docs/#apis-realtime

Returns live conditions at a given location.

Key farming use-cases:
  - Immediate "what is the weather right now?" queries from farmers.
  - Pesticide / fungicide spray decisions:
      wind_kph < 15 and no rain forecast → safe to spray.
  - Fungal disease risk trigger:
      high humidity (> 80 %) + high temperature → alert.
  - Cloud cover check before drone/satellite scouting.
"""

from __future__ import annotations

from weather.client import WeatherClient
from weather.models import CurrentResponse, CurrentWeather, Location


def get_current(
    client: WeatherClient,
    lat: float,
    lon: float,
    lang: str = "en",
    include_aqi: bool = False,
) -> CurrentResponse:
    """
    Fetch real-time weather conditions for the given coordinates.

    Parameters
    ----------
    client:
        An initialised :class:`~weather.client.WeatherClient` instance.
    lat, lon:
        GPS coordinates of the farm.
    lang:
        Language code for condition text.  Use ``"hi"`` for Hindi.
    include_aqi:
        When ``True``, Air Quality Index data is included (requires a
        supported plan). Defaults to ``False``.

    Returns
    -------
    CurrentResponse
        Structured object with ``location``, ``current``
        (:class:`~weather.models.CurrentWeather`) and ``raw`` (full
        JSON payload).

    Example
    -------
    >>> from weather.client import WeatherClient
    >>> from weather.current import get_current
    >>>
    >>> with WeatherClient(api_key="YOUR_KEY") as client:
    ...     result = get_current(client, lat=13.0614, lon=78.3341, lang="hi")
    ...     c = result.current
    ...     print(f"Temp: {c.temp_c}°C  Humidity: {c.humidity}%  Wind: {c.wind_kph} kph {c.wind_dir}")
    ...     if c.wind_kph > 15:
    ...         print("⚠️  Too windy to spray pesticides.")
    ...     if c.humidity > 80 and c.temp_c > 25:
    ...         print("⚠️  High fungal disease risk.")
    """
    params: dict = {
        "q": f"{lat},{lon}",
        "aqi": "yes" if include_aqi else "no",
        "lang": lang,
    }

    raw = client._get("current.json", params)

    location = _parse_location(raw["location"])
    current = _parse_current(raw["current"])

    return CurrentResponse(location=location, current=current, raw=raw)


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


def _parse_current(cur: dict) -> CurrentWeather:
    return CurrentWeather(
        temp_c=cur["temp_c"],
        feels_like_c=cur["feelslike_c"],
        humidity=cur["humidity"],
        wind_kph=cur["wind_kph"],
        wind_dir=cur["wind_dir"],
        wind_degree=cur["wind_degree"],
        cloud=cur["cloud"],
        precip_mm=cur["precip_mm"],
        vis_km=cur["vis_km"],
        uv_index=cur["uv"],
        condition_text=cur["condition"]["text"],
        is_day=bool(cur["is_day"]),
        last_updated=cur["last_updated"],
    )
