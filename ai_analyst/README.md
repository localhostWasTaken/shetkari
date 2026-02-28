# AI Farm Analyst

An AI-powered agricultural advisory system that synthesises **soil health**, **real-time weather forecasts**, and a farmer's **crop plan** into a structured, actionable advisory report — powered by the Gemini API with guaranteed JSON output via Pydantic schemas.

---

## Folder Structure

```
ai_analyst/
├── .env                        # GEMINI_API_KEY (never commit)
├── main.py                     # Entry point — runs demo use cases
├── pyproject.toml
│
├── config/
│   ├── __init__.py
│   └── settings.py             # Loads env vars (API key, model name)
│
├── models/
│   ├── __init__.py
│   ├── inputs.py               # SoilData, WeatherData, WeatherForecast, CropPlan
│   └── outputs.py              # AnalystReport, ActionItem, Alert, FertilizerRecommendation
│
├── analyst/
│   ├── __init__.py
│   ├── prompt_builder.py       # Builds system instruction + user prompt
│   └── engine.py               # Calls Gemini with response_json_schema → AnalystReport
│
└── examples/
    ├── __init__.py
    ├── use_case_a.py           # Smart Fertilizer Advisory (Maize + rain)
    ├── use_case_b.py           # Sowing Viability (Ragi + dry soil)
    └── use_case_c.py           # Pest & Disease Warning (Tomato + humidity)
```

---

## How It Works

1. **Input models** (`models/inputs.py`) define the three data sources as typed Pydantic objects.
2. **Output model** (`models/outputs.py`) defines `AnalystReport` — the fixed JSON schema the LLM always returns.
3. **Prompt builder** (`analyst/prompt_builder.py`) formats the inputs into a rich text prompt and provides the system instruction.
4. **Engine** (`analyst/engine.py`) calls Gemini with:
   - `response_mime_type = "application/json"`
   - `response_json_schema = AnalystReport.model_json_schema()`
   
   This enforces structured output at the API level. The response is then validated with `AnalystReport.model_validate_json(...)`.

---

## Setup

```bash
# 1. Add your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# 2. Install dependencies
uv sync
```

---

## Usage

```bash
# Run all three demo use cases
uv run main.py

# Run a specific use case
uv run main.py a   # Smart Fertilizer Advisory
uv run main.py b   # Sowing Viability
uv run main.py c   # Pest & Disease Warning
```

You can also call the engine directly from your own code:

```python
from analyst.engine import analyse
from models.inputs import SoilData, WeatherData, WeatherForecast, CropPlan

report = analyse(soil, weather, crop)
# report is a fully validated AnalystReport Pydantic object
print(report.full_advisory)
print(report.fertilizer_recommendation)
```

---

## Demo Use Cases

| # | Scenario | Key Insight |
|---|----------|-------------|
| A | Maize (25 days), N-deficient soil, heavy rain tomorrow | "Apply Urea — but wait until Wednesday" |
| B | Ragi planned tomorrow, soil moisture 12 %, no rain for 7 days | "Delay sowing to prevent seed wastage" |
| C | Tomatoes flowering, humidity 85 %+ for 3 days | "Risk of Early Blight — inspect and spray Mancozeb" |
