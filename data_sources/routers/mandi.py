from datetime import datetime
from typing import Optional

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
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    variety: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None, description="Farmer's latitude"),
    longitude: Optional[float] = Query(None, description="Farmer's longitude"),
    radius_km: int = Query(100, description="Search radius in km"),
) -> dict:
    """Get best mandi rates for a commodity with 7-day average pricing."""
    location_filter = {}
    if state:
        location_filter["state"] = state
    if district:
        location_filter["district"] = district

    prices = service.get_commodity_prices(commodity, location_filter)

    if variety:
        prices = [p for p in prices if variety.lower() in (p.get("variety") or "").lower()]

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
        "location": {"state": state, "district": district},
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
# GET /mandi/commodities
# ---------------------------------------------------------------------------

@router.get("/commodities")
async def get_commodities(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
) -> dict:
    """List available commodities, optionally filtered by location."""
    filters = {}
    if state:
        filters["state"] = state
    if district:
        filters["district"] = district

    commodities = service.get_commodities(filters)
    return {"success": True, "commodities": commodities, "total": len(commodities), "filters": filters}


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
