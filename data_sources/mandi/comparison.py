"""
ComparisonService — price analysis, ranking, and recommendations.
"""

from __future__ import annotations

import statistics


def _avg(values: list[float]) -> float:
    filtered = [v for v in values if v > 0]
    if not filtered:
        return 0.0
    return round(sum(filtered) / len(filtered), 2)


def compare_prices(prices: list[dict], sort_by: str = "modal_price", order: str = "desc") -> dict:
    if not prices:
        return {"success": False, "message": "No price data available for comparison"}

    is_average = prices[0].get("is_average", False)
    reverse = order == "desc"
    sorted_prices = sorted(prices, key=lambda p: p.get(sort_by) or p["modal_price"], reverse=reverse)

    modal_values = [p["modal_price"] for p in prices if p["modal_price"] > 0]
    avg_price = _avg(modal_values)
    best = sorted_prices[0]

    stats = {
        "average_price": avg_price,
        "highest_price": max(modal_values),
        "lowest_price": min(modal_values),
        "total_markets": len(prices),
        "price_range": max(modal_values) - min(modal_values),
        "calculation_method": "7-day average" if is_average else "latest price",
    }

    top_five = [
        {
            "rank": i + 1,
            "market": p["market"],
            "district": p["district"],
            "state": p["state"],
            "price": p["modal_price"],
            "price_range": f"₹{p['min_price']} - ₹{p['max_price']}",
            "variety": p.get("variety"),
            "arrival_date": p.get("arrival_date"),
        }
        for i, p in enumerate(sorted_prices[:5])
    ]

    return {
        "success": True,
        "best_mandi": {
            "market": best["market"],
            "district": best["district"],
            "state": best["state"],
            "price": best["modal_price"],
            "min_price": best["min_price"],
            "max_price": best["max_price"],
            "variety": best.get("variety"),
            "grade": best.get("grade"),
            "arrival_date": best.get("arrival_date"),
            "advantage": f"₹{round(best['modal_price'] - avg_price, 2)} above average",
            "days_of_data": best.get("days_of_data", 1),
            "date_range": best.get("date_range") or best.get("arrival_date"),
            "price_type": "7-day average" if best.get("is_average") else "latest price",
        },
        "top_five_markets": top_five,
        "statistics": stats,
        "all_results": [
            {
                "market": p["market"],
                "district": p["district"],
                "state": p["state"],
                "price": p["modal_price"],
                "variety": p.get("variety"),
                "arrival_date": p.get("arrival_date"),
            }
            for p in sorted_prices
        ],
    }


def get_recommendations(prices: list[dict]) -> dict:
    if not prices:
        return {"success": False, "message": "No data available for recommendations"}

    recs = []
    avg_price = _avg([p["modal_price"] for p in prices])

    # Best price
    best = max(prices, key=lambda p: p["modal_price"])
    recs.append(
        {
            "type": "BEST_PRICE",
            "priority": "HIGH",
            "market": best["market"],
            "district": best["district"],
            "state": best["state"],
            "price": best["modal_price"],
            "reason": f"Offers the highest price of ₹{best['modal_price']} per quintal",
            "variety": best.get("variety"),
            "arrival_date": best.get("arrival_date"),
        }
    )

    # Most stable (smallest price range)
    stable_candidates = [p for p in prices if p.get("min_price", 0) > 0 and p.get("max_price", 0) > 0]
    if stable_candidates:
        most_stable = min(stable_candidates, key=lambda p: p["max_price"] - p["min_price"])
        recs.append(
            {
                "type": "MOST_STABLE",
                "priority": "MEDIUM",
                "market": most_stable["market"],
                "district": most_stable["district"],
                "state": most_stable["state"],
                "price": most_stable["modal_price"],
                "price_range": f"₹{most_stable['min_price']} - ₹{most_stable['max_price']}",
                "reason": (
                    f"Most stable pricing with narrow range of "
                    f"₹{round(most_stable['max_price'] - most_stable['min_price'], 2)}"
                ),
                "variety": most_stable.get("variety"),
            }
        )

    # Nearest with above-average price (if distance data present)
    with_distance = [p for p in prices if p.get("distance_km") is not None]
    if with_distance:
        above_avg = [p for p in with_distance if p["modal_price"] >= avg_price]
        if above_avg:
            nearest = min(above_avg, key=lambda p: p["distance_km"])
            recs.append(
                {
                    "type": "NEAREST_GOOD_PRICE",
                    "priority": "MEDIUM",
                    "market": nearest["market"],
                    "district": nearest["district"],
                    "state": nearest["state"],
                    "price": nearest["modal_price"],
                    "distance": f"{nearest['distance_km']} km",
                    "reason": (
                        f"Nearest market with above-average price "
                        f"({nearest['distance_km']} km away)"
                    ),
                    "variety": nearest.get("variety"),
                }
            )

    return {
        "success": True,
        "recommendations": recs,
        "summary": f"Found {len(recs)} recommendations from {len(prices)} markets",
    }


def filter_by_distance(
    prices: list[dict],
    farmer_lat: float,
    farmer_lon: float,
    radius_km: int = 100,
) -> list[dict]:
    """
    Filter price records by distance from the farmer.

    Records without lat/lon are kept by default.  Records
    with coordinates outside the radius are dropped.
    """
    from mandi.location import _haversine_km

    result = []
    for p in prices:
        lat, lon = p.get("latitude"), p.get("longitude")
        if lat is None or lon is None:
            result.append(p)
            continue
        dist = _haversine_km(farmer_lat, farmer_lon, lat, lon)
        if dist <= radius_km:
            result.append({**p, "distance_km": dist})
    return result


def analyze_trend(prices: list[dict]) -> dict:
    if len(prices) < 2:
        return {"trend": "INSUFFICIENT_DATA"}

    sorted_prices = sorted(prices, key=lambda p: p.get("arrival_date") or "")
    first, last = sorted_prices[0]["modal_price"], sorted_prices[-1]["modal_price"]
    change = last - first
    pct = round((change / first) * 100, 2) if first else 0

    return {
        "trend": "INCREASING" if change > 0 else ("DECREASING" if change < 0 else "STABLE"),
        "change": round(change, 2),
        "percent_change": pct,
        "first_date": sorted_prices[0].get("arrival_date"),
        "last_date": sorted_prices[-1].get("arrival_date"),
        "first_price": first,
        "last_price": last,
    }
