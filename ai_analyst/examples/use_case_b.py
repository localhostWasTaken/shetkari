"""
Use Case B: Sowing Viability Advisory
---------------------------------------
Scenario: Farmer wants to sow Ragi tomorrow. Farm is rainfed.
Soil moisture is only 12 % and no rain expected for 7 days.

Expected insight: "Delay sowing — soil too dry and no rain coming."
"""

from datetime import date, timedelta

from models.inputs import CropPlan, SoilData, WeatherData, WeatherForecast
from analyst.engine import analyse


def build_inputs():
    soil = SoilData(
        nitrogen_status="Normal",
        phosphorus_status="Normal",
        potassium_status="Normal",
        ph_level=6.5,
        organic_matter="Low",
        soil_moisture_percent=12.0,  # critically dry
    )

    weather = WeatherData(
        current_temperature_celsius=33.0,
        current_humidity_percent=38.0,
        current_condition="Clear and Sunny",
        forecast=[
            WeatherForecast(
                day_offset=i,
                condition="Clear",
                rain_probability_percent=5.0,
                temperature_celsius=34.0 - i * 0.3,
                humidity_percent=35.0,
                rainfall_mm=0.0,
            )
            for i in range(7)
        ],
    )

    crop = CropPlan(
        crop_name="Ragi",
        variety=None,
        sowing_date=date.today() + timedelta(days=1),  # planning to sow tomorrow
        farm_size_acres=1.5,
        irrigation_type="Rainfed",
        notes="Farmer is eager to sow before the end of the month.",
    )

    return soil, weather, crop


if __name__ == "__main__":
    soil, weather, crop = build_inputs()
    report = analyse(soil, weather, crop)

    print("=" * 60)
    print("USE CASE B — Sowing Viability Advisory")
    print("=" * 60)
    print(f"\n{report.greeting}")
    print(f"\nCrop Stage : {report.crop_stage}")
    print(f"\nSituation  : {report.situation_summary}")

    if report.alerts:
        print("\nALERTS:")
        for a in report.alerts:
            print(f"  [{a.severity}] {a.title}: {a.description}")

    print("\nACTION ITEMS:")
    for item in report.action_items:
        print(f"  [{item.priority}] {item.timing} — {item.action}")
        print(f"           Reason: {item.reason}")

    if report.irrigation_recommendation:
        print(f"\nIRRIGATION: {report.irrigation_recommendation}")

    print(f"\nFULL ADVISORY:\n{report.full_advisory}")
