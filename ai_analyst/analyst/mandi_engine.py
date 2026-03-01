"""
analyst/mandi_engine.py
=======================
Mandi (agricultural market) price advisory engine.

Takes the FULL rich best-rates data from data_sources and generates a detailed,
multilingual advisory using Gemini.
"""

from __future__ import annotations

import time
from typing import Optional

from pydantic import BaseModel
from google import genai
from google.genai import types

from config.settings import GEMINI_API_KEY, GEMINI_MODEL


# ---------------------------------------------------------------------------
# Pydantic models — mirrors the FULL response from comparison.py
# ---------------------------------------------------------------------------

class MandiBestMarket(BaseModel):
    market: str
    district: str
    state: str
    price: float
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    variety: Optional[str] = None
    grade: Optional[str] = None
    arrival_date: Optional[str] = None
    advantage: Optional[str] = None
    days_of_data: Optional[int] = None
    date_range: Optional[str] = None
    price_type: Optional[str] = None
    distance_km: Optional[float] = None


class MandiTopMarket(BaseModel):
    rank: Optional[int] = None
    market: str
    district: str
    state: str
    price: float
    price_range: Optional[str] = None
    variety: Optional[str] = None
    arrival_date: Optional[str] = None
    distance_km: Optional[float] = None


class MandiRecommendation(BaseModel):
    type: str
    priority: str
    market: str
    district: str
    state: str
    price: float
    reason: str
    variety: Optional[str] = None
    distance: Optional[str] = None
    price_range: Optional[str] = None


class MandiStatistics(BaseModel):
    average_price: float
    highest_price: float
    lowest_price: float
    total_markets: Optional[int] = None
    price_range: Optional[float] = None
    calculation_method: Optional[str] = None


class MandiAnalysisRequest(BaseModel):
    commodity: str
    state: Optional[str] = None
    district: Optional[str] = None
    search_radius: Optional[str] = None
    calculation_method: Optional[str] = None
    best_mandi: Optional[MandiBestMarket] = None
    top_markets: list[MandiTopMarket] = []
    statistics: Optional[MandiStatistics] = None
    recommendations: list[MandiRecommendation] = []
    total_markets_analyzed: int = 0
    expected_language: str = "English"


class MandiAdvisoryReport(BaseModel):
    advisory: str


# ---------------------------------------------------------------------------
# Gemini client (singleton)
# ---------------------------------------------------------------------------

_gemini_client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_INSTRUCTION = """You are a knowledgeable mandi (agricultural market) price advisor for Indian farmers.

Write a DETAILED, actionable advisory.
Use WhatsApp-safe formatting: *bold* for section headers and key numbers, plain text otherwise.
Use relevant emojis (one per section) to keep it visually engaging.

STRUCTURE YOUR RESPONSE exactly like this:
1. Commodity name and location header
2. BEST MANDI — name, price, variety, grade, how much above average, distance
3. TOP NEARBY MARKETS — table/list of top 3-5 with prices, varieties, distances
4. PRICE OVERVIEW — average, high, low, spread, how many markets analyzed
5. EXPERT RECOMMENDATIONS — from the data: which market to sell at, why, price trends
6. ACTIONABLE TIPS — 2-3 specific actions the farmer should take right now

Be factual — use ONLY the numbers from the data. Do NOT invent prices.
Be detailed — include varieties, price ranges, distances, dates when available.
Keep each section informative. Total response should be 200-350 words."""

# ---------------------------------------------------------------------------
# Prompt builder — feeds ALL the rich data to Gemini
# ---------------------------------------------------------------------------

def _build_mandi_prompt(req: MandiAnalysisRequest) -> str:
    # ── Best mandi section ──
    if req.best_mandi:
        b = req.best_mandi
        best_lines = [
            f"  Market    : {b.market}, {b.district}, {b.state}",
            f"  Price     : ₹{b.price:.0f}/quintal",
        ]
        if b.min_price and b.max_price:
            best_lines.append(f"  Range     : ₹{b.min_price:.0f} – ₹{b.max_price:.0f}")
        if b.variety:
            best_lines.append(f"  Variety   : {b.variety}")
        if b.grade:
            best_lines.append(f"  Grade     : {b.grade}")
        if b.advantage:
            best_lines.append(f"  Advantage : {b.advantage}")
        if b.price_type:
            best_lines.append(f"  Price type: {b.price_type}")
        if b.date_range:
            best_lines.append(f"  Data period: {b.date_range} ({b.days_of_data or 1} days)")
        if b.distance_km is not None:
            best_lines.append(f"  Distance  : {b.distance_km:.0f} km from farmer")
        best_block = "\n".join(best_lines)
    else:
        best_block = "  No best mandi data available"

    # ── Top markets section ──
    if req.top_markets:
        top_lines = []
        for m in req.top_markets[:5]:
            line = f"  {m.rank or '-'}. {m.market} ({m.district}, {m.state}) — ₹{m.price:.0f}"
            if m.price_range:
                line += f" (range: {m.price_range})"
            if m.variety:
                line += f" [{m.variety}]"
            if m.distance_km is not None:
                line += f" · {m.distance_km:.0f} km"
            if m.arrival_date:
                line += f" (date: {m.arrival_date})"
            top_lines.append(line)
        top_block = "\n".join(top_lines)
    else:
        top_block = "  None"

    # ── Statistics section ──
    if req.statistics:
        s = req.statistics
        stats_block = (
            f"  Average: ₹{s.average_price:.0f} | "
            f"Highest: ₹{s.highest_price:.0f} | "
            f"Lowest: ₹{s.lowest_price:.0f} per quintal"
        )
        if s.price_range:
            stats_block += f"\n  Spread: ₹{s.price_range:.0f}"
        if s.total_markets:
            stats_block += f" across {s.total_markets} markets"
        if s.calculation_method:
            stats_block += f"\n  Method: {s.calculation_method}"
    else:
        stats_block = "  Not available"

    # ── Recommendations section ──
    if req.recommendations:
        rec_lines = []
        for r in req.recommendations:
            line = f"  [{r.priority}] {r.type}: {r.reason}"
            line += f" — {r.market} ({r.district}) at ₹{r.price:.0f}"
            if r.variety:
                line += f" [{r.variety}]"
            if r.distance:
                line += f" ({r.distance})"
            rec_lines.append(line)
        rec_block = "\n".join(rec_lines)
    else:
        rec_block = "  None"

    location_str = ", ".join(filter(None, [req.district, req.state])) or "India"

    return f"""Language to use: {req.expected_language} (use native script)

═══════════════════════════════
DATA (all from real market records)
═══════════════════════════════

Commodity     : {req.commodity}
Location      : {location_str}
Search radius : {req.search_radius or 'N/A'}
Markets found : {req.total_markets_analyzed}
Pricing method: {req.calculation_method or 'N/A'}

▸ BEST MANDI:
{best_block}

▸ TOP MARKETS (ranked by price):
{top_block}

▸ PRICE STATISTICS:
{stats_block}

▸ RECOMMENDATIONS:
{rec_block}

═══════════════════════════════"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_MAX_RETRIES = 2

def analyse_mandi(request: MandiAnalysisRequest) -> str:
    """
    Generate a detailed, multilingual mandi price advisory using Gemini.
    Uses Structured Outputs (`response_json_schema`) to prevent truncation.

    Returns advisory text suitable for WhatsApp delivery.
    """
    prompt = _build_mandi_prompt(request)

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = _gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.4,
                    # JSON schema ensures model finishes generating text completely
                    response_mime_type="application/json",
                    response_json_schema=MandiAdvisoryReport.model_json_schema(),
                ),
            )
            # Log the length to terminal so we can debug if it truncates
            report = MandiAdvisoryReport.model_validate_json(response.text)
            text = report.advisory.strip()
            print(f"DEBUG: Gemini generated {len(text)} characters for {request.expected_language}")
            return text
        except Exception as e:
            if attempt < _MAX_RETRIES and "500" in str(e):
                time.sleep(1)
                continue
            raise
