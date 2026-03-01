from datetime import datetime
import os
from typing import Optional

import requests as _requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from mandi import comparison, location, service

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /mandi/best-rates
# ---------------------------------------------------------------------------

@router.get("/best-rates")
async def best_rates(
    commodity: str = Query(..., description="Crop name, e.g. 'Wheat'"),
    latitude: Optional[float] = Query(None, description="Farmer's latitude"),
    longitude: Optional[float] = Query(None, description="Farmer's longitude"),
    radius_km: int = Query(100, description="Search radius in km"),
) -> dict:
    """Get best mandi rates for a commodity with 7-day average pricing."""
    # TODO: OpenCage not working — hardcoded to Maharashtra/Thane until fixed
    state:    Optional[str] = "Maharashtra"
    district: Optional[str] = "Thane"
    location_filter: dict = {"state": state, "district": district}

    prices = service.get_commodity_prices(commodity, location_filter)
    prices = service.get_7day_average_prices(prices)

    if not prices:
        raise HTTPException(
            status_code=404,
            detail="No price data found for the specified commodity and location.",
        )

    if latitude is not None and longitude is not None:
        prices = location.find_nearby_markets(latitude, longitude, prices, radius_km)

    result = comparison.compare_prices(prices)
    recommendations = comparison.get_recommendations(prices)

    return {
        "success": True,
        "commodity": commodity,
        "location": {"latitude": latitude, "longitude": longitude, "state": state, "district": district},
        "search_radius": f"{radius_km} km",
        "calculation_method": "7-day average prices",
        "best_mandi": result["best_mandi"],
        "top_markets": result["top_five_markets"],
        "recommendations": recommendations["recommendations"],
        "statistics": result["statistics"],
        "total_markets_analyzed": len(prices),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /mandi/compare
# ---------------------------------------------------------------------------

class CompareRequest(BaseModel):
    commodities: list[str]
    state: Optional[str] = None
    district: Optional[str] = None


@router.post("/compare")
async def compare_commodities(body: CompareRequest) -> dict:
    """Compare rates across multiple commodities."""
    if not body.commodities:
        raise HTTPException(status_code=400, detail="'commodities' list is required.")

    location_filter = {}
    if body.state:
        location_filter["state"] = body.state
    if body.district:
        location_filter["district"] = body.district

    results = {}
    for commodity in body.commodities:
        prices = service.get_commodity_prices(commodity, location_filter)
        avg_prices = service.get_7day_average_prices(prices)
        results[commodity] = comparison.compare_prices(avg_prices)

    return {
        "success": True,
        "commodities": body.commodities,
        "location": location_filter,
        "calculation_method": "7-day average prices",
        "results": results,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Helper: OpenCage reverse geocoding  (lat, lon → state, district)
# ---------------------------------------------------------------------------

def _reverse_geocode(lat: float, lon: float) -> dict:
    """
    Convert GPS coordinates to an Indian state + district using the OpenCage
    Geocoding API (https://opencagedata.com/).

    Returns a dict with 'state' and 'district' keys (strings or None).
    Raises HTTPException 502 if the API call fails.
    """
    api_key = os.getenv("OPENGATE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENGATE_API_KEY is not configured.")

    try:
        resp = _requests.get(
            "https://api.opencagedata.com/geocode/v1/json",
            params={
                "q": f"{lat},{lon}",
                "key": api_key,
                "no_annotations": 1,
                "language": "en",
                "countrycode": "in",   # restrict to India
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Reverse geocoding failed: {exc}") from exc

    results = data.get("results", [])
    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No location found for coordinates ({lat}, {lon}).",
        )

    components = results[0].get("components", {})
    # OpenCage returns state as 'state', district is usually 'county' or 'state_district'
    state    = components.get("state") or components.get("state_code")
    district = (
        components.get("county")
        or components.get("state_district")
        or components.get("city_district")
        or components.get("city")
    )
    return {"state": state, "district": district}


# ---------------------------------------------------------------------------
# GET /mandi/commodities
# ---------------------------------------------------------------------------

@router.get("/commodities")
async def get_commodities(
    latitude: float = Query(..., description="Farmer's latitude"),
    longitude: float = Query(..., description="Farmer's longitude"),
    expected_language: Optional[str] = Query("English"),
) -> dict:
    """List available commodities for the farmer's location, translated into the expected language."""
    # TODO: OpenCage not working — hardcoded to Maharashtra/Thane until fixed
    state:    str = "Maharashtra"
    district: str = "Thane"
    filters: dict = {"state": state, "district": district}

    commodities = service.get_commodities(filters)
    translated  = service.get_commodities_in_expected_language(expected_language or "English", commodities)

    return {
        "success": True,
        "location": {"latitude": latitude, "longitude": longitude, "state": state, "district": district},
        "commodities": translated,
        "total": len(translated),
        "filters": filters,
    }


# ---------------------------------------------------------------------------
# GET /mandi/states
# ---------------------------------------------------------------------------

@router.get("/states")
async def get_states() -> dict:
    """List all available states."""
    states = service.get_states()
    return {"success": True, "states": states, "total": len(states)}


# ---------------------------------------------------------------------------
# GET /mandi/districts
# ---------------------------------------------------------------------------

@router.get("/districts")
async def get_districts(
    state: str = Query(..., description="State name"),
) -> dict:
    """List districts for a state."""
    districts = service.get_districts(state)
    return {"success": True, "state": state, "districts": districts, "total": len(districts)}


# ---------------------------------------------------------------------------
# GET /mandi/markets
# ---------------------------------------------------------------------------

@router.get("/markets")
async def get_markets(
    state: str = Query(...),
    district: str = Query(...),
) -> dict:
    """List markets for a state + district."""
    markets = service.get_markets(state, district)
    return {"success": True, "state": state, "district": district, "markets": markets, "total": len(markets)}


# ---------------------------------------------------------------------------
# GET /mandi/nearby
# ---------------------------------------------------------------------------

@router.get("/nearby")
async def nearby_mandis(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: int = Query(100),
) -> dict:
    """Get known mandi locations within a radius of the given coordinates."""
    all_locations = location.get_available_locations()
    nearby = [
        {**loc, "distance_km": location._haversine_km(latitude, longitude, loc["latitude"], loc["longitude"])}
        for loc in all_locations
        if location._haversine_km(latitude, longitude, loc["latitude"], loc["longitude"]) <= radius_km
    ]
    nearby.sort(key=lambda x: x["distance_km"])

    return {
        "success": True,
        "farmer_location": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "nearby_locations": nearby,
        "total": len(nearby),
    }


# ---------------------------------------------------------------------------
# GET /mandi/health
# ---------------------------------------------------------------------------

@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "success": True,
        "status": "healthy",
        "service": "Mandi Rate Comparison API",
        "timestamp": datetime.utcnow().isoformat(),
    }
