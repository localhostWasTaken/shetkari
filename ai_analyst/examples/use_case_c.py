"""
Use Case C: Pest & Disease Outbreak Warning
--------------------------------------------
Scenario: Tomatoes in Flowering stage. Weather shows high humidity
(85 %+) and warm temperatures for 3 consecutive days.

Expected insight: "High risk of Early Blight — inspect and spray Mancozeb."
"""

from datetime import date, timedelta

from models.inputs import CropPlan, SoilData, WeatherData, WeatherForecast
from analyst.engine import analyse


def build_inputs():
    soil = SoilData(
        nitrogen_status="Normal",
        phosphorus_status="Normal",
        potassium_status="Deficient",
        ph_level=6.2,
        organic_matter="Medium",
        soil_moisture_percent=55.0,
    )

    weather = WeatherData(
        current_temperature_celsius=27.0,
        current_humidity_percent=87.0,
        current_condition="Overcast with light drizzle",
        forecast=[
            WeatherForecast(
                day_offset=0,
                condition="Overcast",
                rain_probability_percent=40.0,
                temperature_celsius=27.0,
                humidity_percent=87.0,
                rainfall_mm=5.0,
            ),
            WeatherForecast(
                day_offset=1,
                condition="Cloudy with drizzle",
                rain_probability_percent=55.0,
                temperature_celsius=26.5,
                humidity_percent=89.0,
                rainfall_mm=8.0,
            ),
            WeatherForecast(
                day_offset=2,
                condition="Cloudy",
                rain_probability_percent=45.0,
                temperature_celsius=27.5,
                humidity_percent=85.0,
                rainfall_mm=3.0,
            ),
            WeatherForecast(
                day_offset=3,
                condition="Partly Cloudy",
                rain_probability_percent=25.0,
                temperature_celsius=29.0,
                humidity_percent=70.0,
                rainfall_mm=0.0,
            ),
            WeatherForecast(
                day_offset=4,
                condition="Clear",
                rain_probability_percent=10.0,
                temperature_celsius=30.0,
                humidity_percent=60.0,
                rainfall_mm=0.0,
            ),
        ],
    )

    # Tomatoes sowed ~55 days ago → typically at Flowering stage
    crop = CropPlan(
        crop_name="Tomato",
        variety="Hybrid Roma",
        sowing_date=date.today() - timedelta(days=55),
        farm_size_acres=1.0,
        irrigation_type="Drip",
        notes="Noticed a few yellow spots on lower leaves two days ago.",
    )

    return soil, weather, crop


if __name__ == "__main__":
    soil, weather, crop = build_inputs()
    report = analyse(soil, weather, crop)

    print("=" * 60)
    print("USE CASE C — Pest & Disease Outbreak Warning")
    print("=" * 60)
    print(f"\n{report.greeting}")
    print(f"\nCrop Stage : {report.crop_stage}")
    print(f"\nSituation  : {report.situation_summary}")

    if report.alerts:
        print("\nALERTS:")
        for a in report.alerts:
            print(f"  [{a.severity}] {a.title}")
            print(f"           {a.description}")

    if report.pest_disease_watch:
        print("\nPEST / DISEASE WATCH:")
        for p in report.pest_disease_watch:
            print(f"  • {p}")

    print("\nACTION ITEMS:")
    for item in report.action_items:
        print(f"  [{item.priority}] {item.timing} — {item.action}")
        print(f"           Reason: {item.reason}")

    print(f"\nFULL ADVISORY:\n{report.full_advisory}")
