"""
MandiService — fetches crop price data from the data.gov.in API.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

import requests

from mandi import config

logger = logging.getLogger(__name__)


def _parse_price(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if not value:
        return 0.0
    cleaned = "".join(c for c in str(value) if c.isdigit() or c == ".")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _fetch(filters: dict) -> list[dict]:
    """Raw GET from data.gov.in; returns list of record dicts."""
    params: dict = {
        "api-key": config.API_KEY,
        "format": "json",
        "limit": filters.get("limit", 1000),
        "offset": filters.get("offset", 0),
    }
    for field in ("state", "district", "market", "commodity", "variety", "arrival_date"):
        if filters.get(field):
            params[f"filters[{field}]"] = filters[field]

    url = f"{config.BASE_URL}/{config.RESOURCE_ID}"
    logger.info("Fetching mandi data: %s", url)

    resp = requests.get(
        url,
        params=params,
        timeout=config.REQUEST_TIMEOUT,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()

    if isinstance(data, list):
        return data
    return data.get("records", [])


def _normalise(records: list[dict]) -> list[dict]:
    out = []
    for r in records:
        modal = _parse_price(r.get("modal_price"))
        if modal <= 0:
            continue
        out.append(
            {
                "state": r.get("state"),
                "district": r.get("district"),
                "market": r.get("market"),
                "commodity": r.get("commodity"),
                "variety": r.get("variety"),
                "grade": r.get("grade"),
                "min_price": _parse_price(r.get("min_price")),
                "max_price": _parse_price(r.get("max_price")),
                "modal_price": modal,
                "arrival_date": r.get("arrival_date"),
            }
        )
    return out


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_mandi_prices(filters: dict | None = None) -> list[dict]:
    return _normalise(_fetch(filters or {}))


def get_commodity_prices(commodity: str, location: dict | None = None) -> list[dict]:
    return get_mandi_prices({"commodity": commodity, **(location or {}), "limit": 1000})


def get_states() -> list[str]:
    records = _fetch({"limit": 10000})
    return sorted({r.get("state") for r in records if r.get("state")})


def get_districts(state: str) -> list[str]:
    records = _fetch({"state": state, "limit": 5000})
    return sorted({r.get("district") for r in records if r.get("district")})


def get_markets(state: str, district: str) -> list[str]:
    records = _fetch({"state": state, "district": district, "limit": 5000})
    return sorted({r.get("market") for r in records if r.get("market")})


def get_commodities(filters: dict | None = None) -> list[str]:
    records = _fetch({**(filters or {}), "limit": 10000})
    return sorted({r.get("commodity") for r in records if r.get("commodity")})


def get_latest_prices(prices: list[dict]) -> list[dict]:
    """Keep only the most recent record per (market, commodity, variety) combination."""
    best: dict[str, dict] = {}
    for p in prices:
        key = f"{p['market']}_{p['commodity']}_{p.get('variety') or 'NA'}"
        existing = best.get(key)
        if not existing:
            best[key] = p
        else:
            try:
                if p["arrival_date"] > existing["arrival_date"]:
                    best[key] = p
            except Exception:
                pass
    return list(best.values())


def get_7day_average_prices(prices: list[dict]) -> list[dict]:
    """Calculate 7-day average prices per mandi; falls back to latest if no recent data."""
    if not prices:
        return []

    today = date.today()
    cutoff = today - timedelta(days=7)

    recent = [
        p for p in prices
        if p.get("arrival_date") and p["arrival_date"] >= str(cutoff)
    ]

    if not recent:
        logger.info("No data in last 7 days — using latest prices instead.")
        return get_latest_prices(prices)

    groups: dict[str, dict] = {}
    for p in recent:
        key = f"{p['market']}_{p['district']}_{p['state']}_{p['commodity']}_{p.get('variety') or 'NA'}"
        if key not in groups:
            groups[key] = {**p, "_modals": [], "_mins": [], "_maxes": [], "_dates": []}
        g = groups[key]
        g["_modals"].append(p["modal_price"])
        g["_mins"].append(p["min_price"])
        g["_maxes"].append(p["max_price"])
        g["_dates"].append(p["arrival_date"])

    result = []
    for g in groups.values():
        modals = [x for x in g["_modals"] if x > 0]
        mins = [x for x in g["_mins"] if x > 0]
        maxes = [x for x in g["_maxes"] if x > 0]
        dates = sorted(g["_dates"], reverse=True)

        avg = lambda lst: round(sum(lst) / len(lst), 2) if lst else 0.0

        result.append(
            {
                "state": g["state"],
                "district": g["district"],
                "market": g["market"],
                "commodity": g["commodity"],
                "variety": g.get("variety"),
                "grade": g.get("grade"),
                "min_price": avg(mins),
                "max_price": avg(maxes),
                "modal_price": avg(modals),
                "arrival_date": dates[0],
                "days_of_data": len(g["_modals"]),
                "date_range": f"{dates[-1]} to {dates[0]}",
                "is_average": True,
            }
        )

    return [r for r in result if r["modal_price"] > 0]
