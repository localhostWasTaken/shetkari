"""
Prompt builder for the AI Farm Analyst.

Takes the three structured input objects and assembles a rich
system instruction + user prompt that guides Gemini.
"""

from __future__ import annotations

from datetime import date, timedelta

from models.inputs import CropPlan, SoilData, WeatherData


# ---------------------------------------------------------------------------
# System instruction (static context about the AI's persona and task)
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """\
You are an expert AI Agricultural Analyst specialising in small and medium farms in India.
Your job is to synthesise soil health data, real-time weather forecasts, and the farmer's
crop plan into a single, actionable advisory report.

Rules you MUST follow:
1. Always calculate the crop's current growth stage from the sowing date and crop type.
2. Always factor weather into every recommendation — especially for rainfed farms.
3. Fertilizer quantities must be calculated for the actual farm size provided.
4. If heavy rain (>50 % probability or >20 mm) is expected within 48 hours, warn against
   applying fertilizer or pesticides outdoors.
5. Use warm, respectful language. Begin with a localised greeting like "Namaste!" or
   "Vanakkam!" depending on context.
6. Pest and disease risks must be cross-referenced with both the crop stage AND the weather.
7. Never invent data — if something is missing, say so in the situation_summary field.
8. Your entire response must be valid JSON that matches the provided schema exactly.
"""


# ---------------------------------------------------------------------------
# Helper: describe weather forecast as readable text
# ---------------------------------------------------------------------------

def _format_forecast(weather: WeatherData) -> str:
    today = date.today()
    lines = [
        f"Current: {weather.current_condition}, "
        f"{weather.current_temperature_celsius}°C, "
        f"Humidity {weather.current_humidity_percent}%"
    ]
    for f in weather.forecast:
        day_label = (today + timedelta(days=f.day_offset)).strftime("%A")
        lines.append(
            f"  {day_label} (day+{f.day_offset}): {f.condition} — "
            f"Rain {f.rain_probability_percent:.0f}% prob"
            + (f", {f.rainfall_mm} mm" if f.rainfall_mm is not None else "")
            + f", {f.temperature_celsius}°C, Humidity {f.humidity_percent}%"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Helper: describe soil data as readable text
# ---------------------------------------------------------------------------

def _format_soil(soil: SoilData) -> str:
    lines = [
        f"Nitrogen:   {soil.nitrogen_status}",
        f"Phosphorus: {soil.phosphorus_status}",
        f"Potassium:  {soil.potassium_status}",
        f"pH:         {soil.ph_level}",
        f"Organic matter: {soil.organic_matter}",
    ]
    if soil.soil_moisture_percent is not None:
        lines.append(f"Soil moisture: {soil.soil_moisture_percent}%")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Helper: describe crop plan as readable text
# ---------------------------------------------------------------------------

def _format_crop(crop: CropPlan) -> str:
    days_since_sowing = (date.today() - crop.sowing_date).days
    sowing_str = (
        f"{crop.sowing_date.isoformat()} "
        f"({'sowed ' + str(days_since_sowing) + ' days ago' if days_since_sowing >= 0 else 'planned in ' + str(abs(days_since_sowing)) + ' days'})"
    )
    lines = [
        f"Crop:           {crop.crop_name}" + (f" ({crop.variety})" if crop.variety else ""),
        f"Sowing date:    {sowing_str}",
        f"Farm size:      {crop.farm_size_acres} acres",
        f"Irrigation:     {crop.irrigation_type}",
    ]
    if crop.notes:
        lines.append(f"Farmer notes:   {crop.notes}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public: build the user-turn prompt
# ---------------------------------------------------------------------------

def build_prompt(soil: SoilData, weather: WeatherData, crop: CropPlan, expected_language: str = "English") -> str:
    """Return the user-turn prompt to send to Gemini."""
    return f"""
Please generate a complete farm advisory report for the following data.

=== SOIL DATA ===
{_format_soil(soil)}

=== WEATHER DATA ===
{_format_forecast(weather)}

=== CROP PLAN ===
{_format_crop(crop)}

Analyse all three data sources together and produce the advisory report JSON.
Crucially, generate the values inside the JSON report entirely in {expected_language}, using the native script/alphabet of {expected_language}. (The JSON keys themselves must remain unchanged, only the content values should be translated).
""".strip()
