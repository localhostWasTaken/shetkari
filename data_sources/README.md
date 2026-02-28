# AfterMath Data Sources API

A unified **FastAPI** server that exposes Indian agriculture data through three modules:

| Module | Prefix | Description |
|--------|--------|-------------|
| **Soil Health** | `/soil-health` | Fetch & parse government Soil Health Cards by phone number |
| **Weather** | `/weather` | Current, forecast & historical weather via WeatherAPI |
| **Mandi** | `/mandi` | Crop market prices from data.gov.in with comparison & recommendations |

---

## Quick Start

```bash
# 1. Install dependencies
uv sync            # or: pip install -e .

# 2. Configure environment variables (see .env)
cp .env.example .env
# Fill in WEATHERAPI_KEY and MANDI_API_KEY

# 3. Run the server
uvicorn main:app --reload

# 4. Open interactive docs
open http://localhost:8000/docs
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEATHERAPI_KEY` | Yes (for weather endpoints) | API key from [weatherapi.com](https://www.weatherapi.com/) |
| `MANDI_API_KEY` | Yes (for mandi endpoints) | API key from [data.gov.in](https://data.gov.in/) |
| `MANDI_API_BASE_URL` | No | Defaults to `https://api.data.gov.in/resource` |
| `MANDI_RESOURCE_ID` | No | Defaults to `9ef84268-d588-465a-a308-a864a43d0070` |

---

## Project Structure

```
data_sources/
├── main.py                  ← FastAPI app entry point
├── pyproject.toml           ← Dependencies
├── .env                     ← Environment variables
├── routers/
│   ├── soil_health.py       ← POST /soil-health
│   ├── weather.py           ← GET  /weather/*
│   └── mandi.py             ← GET|POST /mandi/*
├── soil_health/             ← Soil Health Card scraping logic
│   ├── phone_scraper.py
│   ├── html_scraper.py
│   └── html_extractor.py
├── weather/                 ← WeatherAPI client & parsers
│   ├── client.py
│   ├── current.py
│   ├── forecast.py
│   ├── history.py
│   └── models.py
└── mandi/                   ← Mandi price data services
    ├── config.py
    ├── service.py
    ├── comparison.py
    └── location.py
```

---

## API Reference

### Base URL

```
http://localhost:8000
```

Interactive Swagger docs at `/docs`, ReDoc at `/redoc`.

---

## 1. Soil Health

### `POST /soil-health`

Fetch a parsed Soil Health Card for an Indian farmer by phone number.

**Pipeline:** Phone number → GraphQL lookup → computedID → HTML report → structured JSON.

#### Request

```bash
curl -X POST http://localhost:8000/soil-health \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919812345678"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone_number` | string | Yes | Indian mobile number with country code (e.g. `+919812345678`) |

#### Response `200 OK`

```json
{
  "test_center": {
    "Lab Name": "District Soil Testing Laboratory",
    "Lab Code": "KA-BNG-01"
  },
  "test_info": {
    "Sample No": "12345",
    "Cycle": "Cycle-III (2024-25)"
  },
  "sample_info": {
    "Survey No": "45/2",
    "Village": "Hosahalli"
  },
  "beneficiary": {
    "Farmer Name": "Ramesh Kumar",
    "Father Name": "Suresh Kumar",
    "Mobile": "9812345678"
  },
  "plot_info": {
    "Irrigated / Rainfed": "Rainfed"
  },
  "soil_parameters": [
    {
      "name": "उपलब्ध नाइट्रोजन (N)",
      "value": 125.0,
      "unit": "kg/ha",
      "ideal_range": "280 – 560",
      "status": "Deficient",
      "status_color": "orange"
    },
    {
      "name": "pH",
      "value": 7.2,
      "unit": "",
      "ideal_range": "6.5 – 7.5",
      "status": "Adequate",
      "status_color": "green"
    }
  ],
  "fertilizer_recommendations": [
    {
      "crop": "Ragi (all variety / rainfed / kharif)",
      "combination_1": [
        { "product": "15-15-15", "dose": "250 kg/ha" }
      ],
      "combination_2": [],
      "organic": "FYM: 6-8 tons per hectare"
    }
  ],
  "_metadata": {
    "phone_number": "+919812345678",
    "computedID": "SHC-KA-2024-00012345"
  }
}
```

#### Error Responses

| Status | Meaning |
|--------|---------|
| `404` | No soil health data found for this phone number |
| `422` | Valid response but no computedID could be parsed |
| `502` | Failed to fetch HTML report from upstream |

```bash
# 404 example
curl -s -X POST http://localhost:8000/soil-health \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+910000000000"}'
```

```json
{
  "detail": "No valid soil health data found for this phone number."
}
```

---

## 2. Weather

All weather endpoints require the `WEATHERAPI_KEY` environment variable to be set.

### `GET /weather/current`

Real-time weather conditions at given GPS coordinates.

#### Request

```bash
curl "http://localhost:8000/weather/current?lat=13.0614&lon=78.3341&lang=en"
```

#### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lat` | float | Yes | — | Latitude |
| `lon` | float | Yes | — | Longitude |
| `lang` | string | No | `en` | Language code (`hi` = Hindi, `en` = English) |

#### Response `200 OK`

```json
{
  "location": {
    "name": "Kolar",
    "region": "Karnataka",
    "country": "India",
    "lat": 13.06,
    "lon": 78.33,
    "localtime": "2026-03-01 14:30"
  },
  "current": {
    "temp_c": 32.5,
    "feels_like_c": 34.1,
    "humidity": 45,
    "wind_kph": 12.3,
    "wind_dir": "NE",
    "wind_degree": 45,
    "cloud": 25,
    "precip_mm": 0.0,
    "vis_km": 10.0,
    "uv_index": 7.0,
    "condition_text": "Partly cloudy",
    "is_day": true,
    "last_updated": "2026-03-01 14:15"
  }
}
```

---

### `GET /weather/forecast`

Multi-day weather forecast with optional severe weather alerts.

#### Request

```bash
curl "http://localhost:8000/weather/forecast?lat=13.0614&lon=78.3341&days=3&lang=hi&include_alerts=true"
```

#### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lat` | float | Yes | — | Latitude |
| `lon` | float | Yes | — | Longitude |
| `days` | int | No | `3` | Forecast days (1–14) |
| `lang` | string | No | `en` | Language code |
| `include_alerts` | bool | No | `true` | Include severe weather alerts |

#### Response `200 OK`

```json
{
  "location": {
    "name": "Kolar",
    "region": "Karnataka",
    "country": "India",
    "lat": 13.06,
    "lon": 78.33,
    "localtime": "2026-03-01 14:30"
  },
  "forecast_days": [
    {
      "date": "2026-03-01",
      "max_temp_c": 34.2,
      "min_temp_c": 21.5,
      "avg_temp_c": 27.8,
      "max_wind_kph": 18.4,
      "total_precip_mm": 0.0,
      "daily_chance_of_rain": 10,
      "daily_chance_of_snow": 0,
      "avg_humidity": 48.0,
      "condition_text": "Sunny",
      "uv_index": 8.0,
      "sunrise": "06:32 AM",
      "sunset": "06:18 PM"
    },
    {
      "date": "2026-03-02",
      "max_temp_c": 33.0,
      "min_temp_c": 22.1,
      "avg_temp_c": 27.5,
      "max_wind_kph": 15.1,
      "total_precip_mm": 2.4,
      "daily_chance_of_rain": 65,
      "daily_chance_of_snow": 0,
      "avg_humidity": 62.0,
      "condition_text": "Patchy rain possible",
      "uv_index": 6.0,
      "sunrise": "06:31 AM",
      "sunset": "06:18 PM"
    }
  ],
  "alerts": [
    {
      "headline": "Heat wave warning",
      "severity": "Moderate",
      "urgency": "Expected",
      "areas": "Southern Karnataka",
      "event": "Heat Wave",
      "effective": "2026-03-01T09:00:00",
      "expires": "2026-03-03T18:00:00",
      "description": "Maximum temperature likely to exceed 40°C in isolated pockets...",
      "instruction": "Avoid outdoor activities during peak hours."
    }
  ]
}
```

---

### `GET /weather/history`

Observed weather for a specific past date (up to ~7 days on free tier).

#### Request

```bash
curl "http://localhost:8000/weather/history?lat=13.0614&lon=78.3341&dt=2026-02-28&lang=en"
```

#### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lat` | float | Yes | — | Latitude |
| `lon` | float | Yes | — | Longitude |
| `dt` | date | Yes | — | Date to look up (`YYYY-MM-DD`) |
| `lang` | string | No | `en` | Language code |

#### Response `200 OK`

```json
{
  "location": {
    "name": "Kolar",
    "region": "Karnataka",
    "country": "India",
    "lat": 13.06,
    "lon": 78.33,
    "localtime": "2026-03-01 14:30"
  },
  "history_days": [
    {
      "date": "2026-02-28",
      "max_temp_c": 33.8,
      "min_temp_c": 20.4,
      "avg_temp_c": 27.1,
      "total_precip_mm": 0.0,
      "avg_humidity": 42.0,
      "max_wind_kph": 14.8,
      "condition_text": "Sunny",
      "sunrise": "06:33 AM",
      "sunset": "06:17 PM"
    }
  ]
}
```

---

## 3. Mandi (Market Prices)

All mandi endpoints require the `MANDI_API_KEY` environment variable. Data is sourced from the [data.gov.in](https://data.gov.in/) daily mandi prices API.

### `GET /mandi/best-rates`

**Primary farmer endpoint.** Finds the best-paying mandis for a crop using 7-day average pricing.

#### Request

```bash
# Basic — find best rates for Wheat in Maharashtra
curl "http://localhost:8000/mandi/best-rates?commodity=Wheat&state=Maharashtra"

# With location — filter by distance from farmer
curl "http://localhost:8000/mandi/best-rates?commodity=Wheat&state=Maharashtra&latitude=18.5204&longitude=73.8567&radius_km=150"

# With variety filter
curl "http://localhost:8000/mandi/best-rates?commodity=Rice&state=Punjab&variety=Basmati"
```

#### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `commodity` | string | Yes | — | Crop name (e.g. `Wheat`, `Rice`, `Onion`) |
| `state` | string | No | — | Filter by state |
| `district` | string | No | — | Filter by district |
| `variety` | string | No | — | Filter by variety (e.g. `Basmati`) |
| `latitude` | float | No | — | Farmer's latitude (enables distance filtering) |
| `longitude` | float | No | — | Farmer's longitude |
| `radius_km` | int | No | `100` | Search radius in km |

#### Response `200 OK`

```json
{
  "success": true,
  "commodity": "Wheat",
  "location": { "state": "Maharashtra", "district": null },
  "search_radius": "100 km",
  "calculation_method": "7-day average prices",
  "best_mandi": {
    "market": "Pune",
    "district": "Pune",
    "state": "Maharashtra",
    "price": 2850.0,
    "min_price": 2700.0,
    "max_price": 3000.0,
    "variety": "Lokwan",
    "grade": "FAQ",
    "arrival_date": "2026-02-28",
    "advantage": "₹250.5 above average",
    "days_of_data": 5,
    "date_range": "2026-02-22 to 2026-02-28",
    "price_type": "7-day average"
  },
  "top_markets": [
    {
      "rank": 1,
      "market": "Pune",
      "district": "Pune",
      "state": "Maharashtra",
      "price": 2850.0,
      "price_range": "₹2700.0 - ₹3000.0",
      "variety": "Lokwan",
      "arrival_date": "2026-02-28"
    },
    {
      "rank": 2,
      "market": "Nagpur",
      "district": "Nagpur",
      "state": "Maharashtra",
      "price": 2720.0,
      "price_range": "₹2600.0 - ₹2800.0",
      "variety": "Lokwan",
      "arrival_date": "2026-02-27"
    }
  ],
  "recommendations": [
    {
      "type": "BEST_PRICE",
      "priority": "HIGH",
      "market": "Pune",
      "district": "Pune",
      "state": "Maharashtra",
      "price": 2850.0,
      "reason": "Offers the highest price of ₹2850.0 per quintal",
      "variety": "Lokwan",
      "arrival_date": "2026-02-28"
    },
    {
      "type": "MOST_STABLE",
      "priority": "MEDIUM",
      "market": "Solapur",
      "district": "Solapur",
      "state": "Maharashtra",
      "price": 2650.0,
      "price_range": "₹2620.0 - ₹2680.0",
      "reason": "Most stable pricing with narrow range of ₹60.0",
      "variety": "Lokwan"
    }
  ],
  "statistics": {
    "average_price": 2599.5,
    "highest_price": 2850.0,
    "lowest_price": 2350.0,
    "total_markets": 12,
    "price_range": 500.0,
    "calculation_method": "7-day average"
  },
  "total_markets_analyzed": 12,
  "timestamp": "2026-03-01T09:15:42.123456"
}
```

#### Error `404`

```json
{
  "detail": "No price data found for the specified commodity and location."
}
```

---

### `POST /mandi/compare`

Compare prices across multiple commodities at once.

#### Request

```bash
curl -X POST http://localhost:8000/mandi/compare \
  -H "Content-Type: application/json" \
  -d '{
    "commodities": ["Wheat", "Rice", "Onion"],
    "state": "Maharashtra"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `commodities` | string[] | Yes | List of crop names to compare |
| `state` | string | No | Filter by state |
| `district` | string | No | Filter by district |

#### Response `200 OK`

```json
{
  "success": true,
  "commodities": ["Wheat", "Rice", "Onion"],
  "location": { "state": "Maharashtra" },
  "calculation_method": "7-day average prices",
  "results": {
    "Wheat": {
      "success": true,
      "best_mandi": {
        "market": "Pune",
        "district": "Pune",
        "state": "Maharashtra",
        "price": 2850.0,
        "min_price": 2700.0,
        "max_price": 3000.0,
        "variety": "Lokwan",
        "grade": "FAQ",
        "arrival_date": "2026-02-28",
        "advantage": "₹250.5 above average",
        "days_of_data": 5,
        "date_range": "2026-02-22 to 2026-02-28",
        "price_type": "7-day average"
      },
      "top_five_markets": ["..."],
      "statistics": {"..."},
      "all_results": ["..."]
    },
    "Rice": {"..."},
    "Onion": {"..."}
  },
  "timestamp": "2026-03-01T09:20:00.000000"
}
```

---

### `GET /mandi/commodities`

List all available commodities, optionally filtered by location.

#### Request

```bash
# All commodities
curl "http://localhost:8000/mandi/commodities"

# Filter by state
curl "http://localhost:8000/mandi/commodities?state=Karnataka"

# Filter by state + district
curl "http://localhost:8000/mandi/commodities?state=Karnataka&district=Bangalore"
```

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | string | No | Filter by state |
| `district` | string | No | Filter by district |

#### Response `200 OK`

```json
{
  "success": true,
  "commodities": [
    "Arhar (Tur/Red Gram)",
    "Bajra(Pearl Millet/Cumbu)",
    "Bengal Gram(Gram)(Whole)",
    "Cotton",
    "Groundnut",
    "Jowar(Sorghum)",
    "Maize",
    "Onion",
    "Paddy(Dhan)(Common)",
    "Potato",
    "Rice",
    "Soyabean",
    "Tomato",
    "Wheat"
  ],
  "total": 14,
  "filters": { "state": "Karnataka" }
}
```

---

### `GET /mandi/states`

List all states with available mandi data.

#### Request

```bash
curl "http://localhost:8000/mandi/states"
```

#### Response `200 OK`

```json
{
  "success": true,
  "states": [
    "Andhra Pradesh",
    "Bihar",
    "Gujarat",
    "Haryana",
    "Karnataka",
    "Madhya Pradesh",
    "Maharashtra",
    "Punjab",
    "Rajasthan",
    "Tamil Nadu",
    "Telangana",
    "Uttar Pradesh",
    "West Bengal"
  ],
  "total": 13
}
```

---

### `GET /mandi/districts`

List all districts for a given state.

#### Request

```bash
curl "http://localhost:8000/mandi/districts?state=Maharashtra"
```

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | string | Yes | State name |

#### Response `200 OK`

```json
{
  "success": true,
  "state": "Maharashtra",
  "districts": [
    "Ahmednagar",
    "Aurangabad",
    "Mumbai",
    "Nagpur",
    "Nashik",
    "Pune",
    "Solapur"
  ],
  "total": 7
}
```

---

### `GET /mandi/markets`

List all markets (mandis) for a state + district combination.

#### Request

```bash
curl "http://localhost:8000/mandi/markets?state=Maharashtra&district=Pune"
```

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | string | Yes | State name |
| `district` | string | Yes | District name |

#### Response `200 OK`

```json
{
  "success": true,
  "state": "Maharashtra",
  "district": "Pune",
  "markets": [
    "Baramati",
    "Gultekdi(Pune)",
    "Junnar",
    "Manchar",
    "Pune",
    "Shirur"
  ],
  "total": 6
}
```

---

### `GET /mandi/nearby`

Find known mandi locations within a radius of the farmer's GPS coordinates.

#### Request

```bash
curl "http://localhost:8000/mandi/nearby?latitude=18.5204&longitude=73.8567&radius_km=200"
```

#### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `latitude` | float | Yes | — | Farmer's latitude |
| `longitude` | float | Yes | — | Farmer's longitude |
| `radius_km` | int | No | `100` | Search radius in km |

#### Response `200 OK`

```json
{
  "success": true,
  "farmer_location": {
    "latitude": 18.5204,
    "longitude": 73.8567
  },
  "radius_km": 200,
  "nearby_locations": [
    {
      "state": "Maharashtra",
      "district": "Pune",
      "latitude": 18.5204,
      "longitude": 73.8567,
      "distance_km": 0.0
    },
    {
      "state": "Maharashtra",
      "district": "Mumbai",
      "latitude": 19.076,
      "longitude": 72.8777,
      "distance_km": 120.4
    }
  ],
  "total": 2
}
```

---

### `GET /mandi/health`

Health check endpoint.

#### Request

```bash
curl "http://localhost:8000/mandi/health"
```

#### Response `200 OK`

```json
{
  "success": true,
  "status": "healthy",
  "service": "Mandi Rate Comparison API",
  "timestamp": "2026-03-01T09:25:00.000000"
}
```

---

## All Endpoints Summary

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `POST` | `/soil-health` | Soil Health Card data by phone number |
| 2 | `GET` | `/weather/current` | Real-time weather at coordinates |
| 3 | `GET` | `/weather/forecast` | Multi-day forecast with alerts |
| 4 | `GET` | `/weather/history` | Historical weather for a past date |
| 5 | `GET` | `/mandi/best-rates` | Best mandi rates for a crop (7-day avg) |
| 6 | `POST` | `/mandi/compare` | Compare multiple commodities |
| 7 | `GET` | `/mandi/commodities` | List available commodities |
| 8 | `GET` | `/mandi/states` | List available states |
| 9 | `GET` | `/mandi/districts` | Districts for a state |
| 10 | `GET` | `/mandi/markets` | Markets for state + district |
| 11 | `GET` | `/mandi/nearby` | Nearby mandis by GPS coordinates |
| 12 | `GET` | `/mandi/health` | Health check |
