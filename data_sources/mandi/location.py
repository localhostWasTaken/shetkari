"""
LocationService — coordinates database and distance helpers.

Distance calculation uses an inline Haversine formula (no extra dependency).
"""

from __future__ import annotations

import math

# Coordinates for major Indian cities/districts.
# Key format: 'State:District'
_LOCATION_DB: dict[str, tuple[float, float]] = {
    "Maharashtra:Pune": (18.5204, 73.8567),
    "Maharashtra:Mumbai": (19.0760, 72.8777),
    "Maharashtra:Nagpur": (21.1458, 79.0882),
    "Karnataka:Bangalore": (12.9716, 77.5946),
    "Karnataka:Mysore": (12.2958, 76.6394),
    "Tamil Nadu:Chennai": (13.0827, 80.2707),
    "Tamil Nadu:Coimbatore": (11.0168, 76.9558),
    "Gujarat:Ahmedabad": (23.0225, 72.5714),
    "Gujarat:Surat": (21.1702, 72.8311),
    "Rajasthan:Jaipur": (26.9124, 75.7873),
    "Uttar Pradesh:Lucknow": (26.8467, 80.9462),
    "Uttar Pradesh:Kanpur": (26.4499, 80.3319),
    "Madhya Pradesh:Bhopal": (23.2599, 77.4126),
    "Madhya Pradesh:Indore": (22.7196, 75.8577),
    "Punjab:Ludhiana": (30.9010, 75.8573),
    "Punjab:Amritsar": (31.6340, 74.8723),
    "Haryana:Gurgaon": (28.4595, 77.0266),
    "Haryana:Faridabad": (28.4089, 77.3178),
    "West Bengal:Kolkata": (22.5726, 88.3639),
    "Telangana:Hyderabad": (17.3850, 78.4867),
    "Andhra Pradesh:Visakhapatnam": (17.6868, 83.2185),
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in km between two GPS points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def get_coordinates(state: str, district: str) -> tuple[float, float] | None:
    return _LOCATION_DB.get(f"{state}:{district}")


def calculate_distance(
    loc1: tuple[float, float], loc2: tuple[float, float]
) -> float | None:
    if not loc1 or not loc2:
        return None
    return _haversine_km(loc1[0], loc1[1], loc2[0], loc2[1])


def enrich_with_coordinates(prices: list[dict]) -> list[dict]:
    enriched = []
    for p in prices:
        coords = get_coordinates(p.get("state", ""), p.get("district", ""))
        enriched.append(
            {
                **p,
                "latitude": coords[0] if coords else None,
                "longitude": coords[1] if coords else None,
            }
        )
    return enriched


def find_nearby_markets(
    farmer_lat: float,
    farmer_lon: float,
    prices: list[dict],
    radius_km: int = 100,
) -> list[dict]:
    enriched = enrich_with_coordinates(prices)
    result = []
    for p in enriched:
        if p.get("latitude") and p.get("longitude"):
            dist = _haversine_km(farmer_lat, farmer_lon, p["latitude"], p["longitude"])
            if dist <= radius_km:
                result.append({**p, "distance_km": dist})
        else:
            result.append({**p, "distance_km": None})

    return sorted(
        result,
        key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0),
    )


def group_by_proximity(prices: list[dict]) -> dict[str, list[dict]]:
    """Group price records by distance zones (requires `distance_km` key)."""
    zones: dict[str, list[dict]] = {
        "very_close": [],  # 0-25 km
        "nearby": [],      # 25-50 km
        "moderate": [],    # 50-100 km
        "far": [],         # 100+ km
    }
    for p in prices:
        d = p.get("distance_km")
        if d is None:
            zones["far"].append(p)
        elif d <= 25:
            zones["very_close"].append(p)
        elif d <= 50:
            zones["nearby"].append(p)
        elif d <= 100:
            zones["moderate"].append(p)
        else:
            zones["far"].append(p)
    return zones


def get_available_locations() -> list[dict]:
    """Return every entry in the location database as a list of dicts."""
    return [
        {
            "state": key.split(":")[0],
            "district": key.split(":")[1],
            "latitude": coords[0],
            "longitude": coords[1],
        }
        for key, coords in _LOCATION_DB.items()
    ]


def add_location(state: str, district: str, latitude: float, longitude: float) -> None:
    """Register a new location at runtime (extends coverage)."""
    _LOCATION_DB[f"{state}:{district}"] = (latitude, longitude)
