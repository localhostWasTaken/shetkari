"""
History API  →  GET /v1/history.json
https://www.weatherapi.com/docs/#apis-history

Returns observed weather for a specific past date.

Key farming use-cases:
  - "How much did it rain yesterday?" → soil moisture proxy without a sensor.
  - Retroactive crop disease diagnosis: LLM uses past humidity + temperature
    to correlate with the disease symptoms the farmer is describing.
  - Verifying whether irrigation was actually needed on a given day.

Note
----
The free WeatherAPI tier limits historical lookups to ~7 days in the past.
Paid tiers unlock longer history windows.
"""

from __future__ import annotations

from datetime import date, datetime

from weather.client import WeatherClient
from weather.models import HistoryDay, HistoryResponse, Location


def get_history(
    client: WeatherClient,
    lat: float,
    lon: float,
    dt: date | str,
    lang: str = "en",
) -> HistoryResponse:
    """
    Fetch observed weather for a specific past date.

    Parameters
    ----------
    client:
        An initialised :class:`~weather.client.WeatherClient` instance.
    lat, lon:
        GPS coordinates of the farm.
    dt:
        The date to look up.  Accepts a :class:`datetime.date` object
        or an ISO-format string (``"YYYY-MM-DD"``).
    lang:
        Language code for condition text.  Use ``"hi"`` for Hindi.

    Returns
    -------
    HistoryResponse
        Structured object with ``location``, ``history_days`` (list of
        :class:`~weather.models.HistoryDay`) and ``raw`` (full JSON
        payload).

    Raises
    ------
    WeatherAPIError
        If the date is out of range for your plan, or if the API key is
        invalid.

    Example
    -------
    >>> from datetime import date, timedelta
    >>> from weather.client import WeatherClient
    >>> from weather.history import get_history
    >>>
    >>> yesterday = date.today() - timedelta(days=1)
    >>> with WeatherClient(api_key="YOUR_KEY") as client:
    ...     result = get_history(client, lat=13.0614, lon=78.3341, dt=yesterday)
    ...     h = result.history_days[0]
    ...     print(f"{h.date}: {h.total_precip_mm} mm rain, avg humidity {h.avg_humidity}%")
    ...     if h.total_precip_mm > 10:
    ...         print("Soil likely saturated — hold off on irrigation today.")
    """
    if isinstance(dt, (date, datetime)):
        dt_str = dt.strftime("%Y-%m-%d")
    else:
        dt_str = dt  # already a string — validated by the API

    params: dict = {
        "q": f"{lat},{lon}",
        "dt": dt_str,
        "lang": lang,
    }

    raw = client._get("history.json", params)

    location = _parse_location(raw["location"])
    history_days = [_parse_history_day(fd) for fd in raw["forecast"]["forecastday"]]

    return HistoryResponse(location=location, history_days=history_days, raw=raw)


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


def _parse_history_day(fd: dict) -> HistoryDay:
    day = fd["day"]
    astro = fd.get("astro", {})
    return HistoryDay(
        date=fd["date"],
        max_temp_c=day["maxtemp_c"],
        min_temp_c=day["mintemp_c"],
        avg_temp_c=day["avgtemp_c"],
        total_precip_mm=day["totalprecip_mm"],
        avg_humidity=day["avghumidity"],
        max_wind_kph=day["maxwind_kph"],
        condition_text=day["condition"]["text"],
        sunrise=astro.get("sunrise", ""),
        sunset=astro.get("sunset", ""),
    )
