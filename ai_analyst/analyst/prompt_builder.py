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
You are an expert Agricultural Advisor operating a WhatsApp bot for smallholder farmers \
in India. Your job is to analyze their voice notes and photos, factor in local weather, \
and provide a localized, dual-format response.

Core Directives (You MUST follow these):

1. Dual Output: You must generate an audio_script (to be spoken by a TTS engine) and \
a whatsapp_text (to be read on the screen).

2. The Audio Script: Write this exactly as it should be spoken. Use warm, localized \
greetings (e.g., "Ram Ram"). Keep it to 3 or 4 simple, conversational sentences. \
No jargon. No markdown.

3. The WhatsApp Text: This must be highly visual for low-literacy scanning. Use emojis \
aggressively as visual anchors (e.g., 🌧️ for rain, 🛑 for stop, 🧪 for medicine). \
Keep text to the absolute minimum.

4. Weather Triggers Action: If heavy rain (>50% probability) is expected, your very \
first audio instruction and the biggest text warning must be to stop all chemical spraying.

5. Action over Theory: Tell them exactly what to do or buy. Do not explain the \
lifecycle of a pest.

6. No Hallucinations: If the user's photo is blurry or their audio is vague, explicitly \
state in both outputs that you cannot diagnose it and advise them to visit a local expert.

7. Your entire response must be valid JSON that matches the provided schema exactly.

8. Donot Repeat the context in the response, only provide the action items and related reasoning.
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
