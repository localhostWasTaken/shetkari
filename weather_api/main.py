"""
Usage example — run with:
    WEATHERAPI_KEY=your_key python main.py

Or hard-code the key below for quick local testing.
"""

from datetime import date, timedelta

from weather import WeatherClient, get_current, get_forecast, get_history

# Coordinates: example farm near Kolar, Karnataka, India
LAT, LON = 13.0614, 78.3341

# Language: "hi" = Hindi, "en" = English
LANG = "en"


def demo_forecast(client: WeatherClient) -> None:
    print("\n" + "=" * 60)
    print("3-DAY FORECAST  (with severe weather alerts)")
    print("=" * 60)

    result = get_forecast(client, lat=LAT, lon=LON, days=3, lang=LANG, include_alerts=True)

    print(f"Location : {result.location.name}, {result.location.region}")
    print(f"Local time: {result.location.localtime}\n")

    for day in result.forecast_days:
        print(f"  {day.date}")
        print(f"    Condition       : {day.condition_text}")
        print(f"    Temp (min/max)  : {day.min_temp_c}°C / {day.max_temp_c}°C")
        print(f"    Rain chance     : {day.daily_chance_of_rain}%")
        print(f"    Expected rain   : {day.total_precip_mm} mm")
        print(f"    Max wind        : {day.max_wind_kph} kph")
        print(f"    Humidity (avg)  : {day.avg_humidity}%")
        print(f"    UV index        : {day.uv_index}")
        print()

    if result.alerts:
        print(f"  ⚠️  {len(result.alerts)} SEVERE WEATHER ALERT(S):")
        for alert in result.alerts:
            print(f"     [{alert.severity}] {alert.headline}")
            print(f"     Expires : {alert.expires}")
            print(f"     {alert.description[:200]}...")
    else:
        print("  ✅ No severe weather alerts.")


def demo_current(client: WeatherClient) -> None:
    print("\n" + "=" * 60)
    print("CURRENT / REALTIME WEATHER")
    print("=" * 60)

    result = get_current(client, lat=LAT, lon=LON, lang=LANG)
    c = result.current

    print(f"Location    : {result.location.name}, {result.location.region}")
    print(f"Updated at  : {c.last_updated}\n")
    print(f"  Condition   : {c.condition_text}")
    print(f"  Temperature : {c.temp_c}°C  (feels like {c.feels_like_c}°C)")
    print(f"  Humidity    : {c.humidity}%")
    print(f"  Wind        : {c.wind_kph} kph  {c.wind_dir}")
    print(f"  Cloud cover : {c.cloud}%")
    print(f"  Precip today: {c.precip_mm} mm")
    print(f"  UV index    : {c.uv_index}")

    # ---- Simple farm-decision helpers ----
    print()
    if c.wind_kph > 15:
        print("  ⚠️  Wind too high for pesticide spraying (> 15 kph).")
    else:
        print("  ✅ Wind speed safe for spraying.")

    if c.humidity > 80 and c.temp_c > 25:
        print("  ⚠️  High humidity + heat → elevated fungal disease risk.")


def demo_history(client: WeatherClient) -> None:
    print("\n" + "=" * 60)
    print("HISTORICAL WEATHER  (yesterday)")
    print("=" * 60)

    yesterday = date.today() - timedelta(days=1)
    result = get_history(client, lat=LAT, lon=LON, dt=yesterday, lang=LANG)

    print(f"Location : {result.location.name}, {result.location.region}\n")

    for h in result.history_days:
        print(f"  {h.date}")
        print(f"    Condition     : {h.condition_text}")
        print(f"    Temp (min/max): {h.min_temp_c}°C / {h.max_temp_c}°C")
        print(f"    Rainfall      : {h.total_precip_mm} mm")
        print(f"    Avg humidity  : {h.avg_humidity}%")
        print(f"    Max wind      : {h.max_wind_kph} kph")

        if h.total_precip_mm > 10:
            print("    💧 Soil likely saturated — consider skipping irrigation today.")
        elif h.total_precip_mm > 0:
            print("    🌦️  Light rain yesterday — monitor soil moisture.")
        else:
            print("    ☀️  Dry yesterday — check irrigation needs.")


def main() -> None:
    # Initialise client once; reuse across all calls.
    # api_key= can be omitted if WEATHERAPI_KEY env var is set.
    with WeatherClient() as client:
        demo_forecast(client)
        demo_current(client)
        demo_history(client)


if __name__ == "__main__":
    main()

