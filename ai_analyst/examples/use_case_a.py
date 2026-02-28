"""
Use Case A: "Smart Fertilizer" Advisory
----------------------------------------
Scenario: Maize at 25 days needs Nitrogen. Soil is Nitrogen deficient.
Weather shows 80 % chance of heavy rain tomorrow.

Expected insight: "Apply Urea — but NOT today, wait until Wednesday."
"""

from datetime import date, timedelta

from models.inputs import CropPlan, SoilData, WeatherData, WeatherForecast
from analyst.engine import analyse


def build_inputs():
    soil = SoilData(
        nitrogen_status="Deficient",
        phosphorus_status="Normal",
        potassium_status="Normal",
        ph_level=6.8,
        organic_matter="Medium",
        soil_moisture_percent=35.0,
    )

    today = date.today()
    weather = WeatherData(
        current_temperature_celsius=29.0,
        current_humidity_percent=62.0,
        current_condition="Partly Cloudy",
        forecast=[
            WeatherForecast(
                day_offset=0,
                condition="Partly Cloudy",
                rain_probability_percent=20.0,
                temperature_celsius=29.0,
                humidity_percent=62.0,
                rainfall_mm=0.0,
            ),
            WeatherForecast(
                day_offset=1,
                condition="Heavy Rain",
                rain_probability_percent=80.0,
                temperature_celsius=25.0,
                humidity_percent=88.0,
                rainfall_mm=45.0,
            ),
            WeatherForecast(
                day_offset=2,
                condition="Heavy Rain",
                rain_probability_percent=70.0,
                temperature_celsius=24.0,
                humidity_percent=90.0,
                rainfall_mm=30.0,
            ),
            WeatherForecast(
                day_offset=3,
                condition="Clear",
                rain_probability_percent=10.0,
                temperature_celsius=30.0,
                humidity_percent=55.0,
                rainfall_mm=0.0,
            ),
            WeatherForecast(
                day_offset=4,
                condition="Clear",
                rain_probability_percent=5.0,
                temperature_celsius=31.0,
                humidity_percent=50.0,
                rainfall_mm=0.0,
            ),
        ],
    )

    crop = CropPlan(
        crop_name="Maize",
        variety="Hybrid 614",
        sowing_date=today - timedelta(days=25),
        farm_size_acres=2.0,
        irrigation_type="Rainfed",
    )

    return soil, weather, crop


if __name__ == "__main__":
    soil, weather, crop = build_inputs()
    report = analyse(soil, weather, crop)

    print("=" * 60)
    print("USE CASE A — Smart Fertilizer Advisory")
    print("=" * 60)
    print(f"\n{report.greeting}")
    print(f"\nCrop Stage : {report.crop_stage}")
    print(f"\nSituation  : {report.situation_summary}")

    if report.alerts:
        print("\nALERTS:")
        for a in report.alerts:
            print(f"  [{a.severity}] {a.title}: {a.description}")

    if report.fertilizer_recommendation:
        f = report.fertilizer_recommendation
        print(f"\nFERTILIZER: {f.fertilizer_name}")
        print(f"  Rate    : {f.quantity_kg_per_acre} kg/acre  |  Total: {f.total_quantity_kg} kg")
        print(f"  Method  : {f.application_method}")
        print(f"  Timing  : {f.timing_notes}")

    print("\nACTION ITEMS:")
    for item in report.action_items:
        print(f"  [{item.priority}] {item.timing} — {item.action}")
        print(f"           Reason: {item.reason}")

    print(f"\nFULL ADVISORY:\n{report.full_advisory}")
