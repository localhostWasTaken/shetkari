"""
Gemini inference engine for the AI Farm Analyst.

Calls the Gemini API with:
  - A system instruction that defines the AI persona.
  - The assembled user prompt (soil + weather + crop data).
  - `response_mime_type = "application/json"` + `response_json_schema`
    so the model is constrained to always return a valid AnalystReport.
"""

from __future__ import annotations

from google import genai
from google.genai import types

from config.settings import GEMINI_API_KEY, GEMINI_MODEL
from models.inputs import CropPlan, SoilData, WeatherData
from models.outputs import AnalystReport
from analyst.prompt_builder import SYSTEM_INSTRUCTION, build_prompt


# ---------------------------------------------------------------------------
# Gemini client (singleton)
# ---------------------------------------------------------------------------

_client = genai.Client(api_key=GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyse(
    soil: SoilData,
    weather: WeatherData,
    crop: CropPlan,
    *,
    expected_language: str = "English",
    model: str | None = None,
) -> AnalystReport:
    """
    Run the AI Farm Analyst and return a validated AnalystReport.

    Parameters
    ----------
    soil:    Soil nutrient and moisture data.
    weather: Current weather + 7-day forecast.
    crop:    The farmer's active crop plan.
    expected_language: Target language for the report.
    model:   Override the Gemini model name (defaults to settings.GEMINI_MODEL).

    Returns
    -------
    AnalystReport — a fully validated Pydantic object.
    """
    prompt = build_prompt(soil, weather, crop, expected_language)

    response = _client.models.generate_content(
        model=model or GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_json_schema=AnalystReport.model_json_schema(),
        ),
    )

    return AnalystReport.model_validate_json(response.text)
