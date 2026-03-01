"""
analyst/mandi_engine.py
=======================
Mandi (agricultural market) price advisory engine.

Takes raw best-rates data from data_sources and generates a concise,
multilingual advisory using Gemini.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel
from google import genai
from google.genai import types

from config.settings import GEMINI_API_KEY, GEMINI_MODEL


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class MandiMarket(BaseModel):
    market: str
    district: str
    modal_price: float
    distance_km: Optional[float] = None


class MandiStatistics(BaseModel):
    average_price: float
    highest_price: float
    lowest_price: float


class MandiAnalysisRequest(BaseModel):
    commodity: str
    state: Optional[str] = None
    district: Optional[str] = None
    best_mandi: Optional[MandiMarket] = None
    top_markets: list[MandiMarket] = []
    statistics: Optional[MandiStatistics] = None
    recommendations: list[str] = []
    total_markets_analyzed: int = 0
    expected_language: str = "English"


# ---------------------------------------------------------------------------
# Gemini client (singleton)
# ---------------------------------------------------------------------------

_gemini_client = genai.Client(api_key=GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_mandi_prompt(req: MandiAnalysisRequest) -> str:
    best = (
        f"{req.best_mandi.market} ({req.best_mandi.district}) at "
        f"₹{req.best_mandi.modal_price:.0f}/quintal"
        + (f", {req.best_mandi.distance_km:.0f} km away" if req.best_mandi.distance_km is not None else "")
        if req.best_mandi else "Not available"
    )
    top = "\n".join(
        f"  - {m.market} ({m.district}): ₹{m.modal_price:.0f}"
        + (f" [{m.distance_km:.0f} km]" if m.distance_km is not None else "")
        for m in req.top_markets[:3]
    ) or "  None"
    stats = (
        f"Low ₹{req.statistics.lowest_price:.0f} / "
        f"Avg ₹{req.statistics.average_price:.0f} / "
        f"High ₹{req.statistics.highest_price:.0f} per quintal"
        if req.statistics else "Not available"
    )
    tips = "\n".join(f"  - {r}" for r in req.recommendations[:3]) or "  None"
    location_str = ", ".join(filter(None, [req.district, req.state])) or "India"

    return f"""You are a concise mandi (agricultural market) price advisor for Indian farmers.

Write a short, actionable advisory in {req.expected_language} using the native script of that language.
Use WhatsApp-safe formatting only: *bold* for key labels, plain text for everything else, one emoji per section max.
Be factual, precise, and direct. Do NOT add greetings, disclaimers, or filler sentences.
Total response must be under 250 words.

DATA:
Commodity : {req.commodity}
Location  : {location_str}
Markets checked: {req.total_markets_analyzed}

Best mandi: {best}

Top nearby mandis:
{top}

Price range today:
{stats}

Recommendations from market data:
{tips}

Now write the advisory:"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyse_mandi(request: MandiAnalysisRequest) -> str:
    """
    Generate a concise, multilingual mandi price advisory using Gemini.

    Returns plain advisory text suitable for WhatsApp delivery.
    """
    prompt = _build_mandi_prompt(request)
    response = _gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,    # low temp = factual, consistent
            max_output_tokens=400,
        ),
    )
    return response.text.strip()
