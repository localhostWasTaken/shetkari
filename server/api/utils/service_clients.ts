/**
 * HTTP client helpers for calling the data_sources and ai_analyst microservices.
 *
 * Base URLs are read from environment variables:
 *   DATA_SOURCES_BASE_URL  (default http://127.0.0.1:8001)
 *   AI_ANALYST_BASE_URL    (default http://127.0.0.1:8002)
 */

// ---------------------------------------------------------------------------
// Base URLs
// ---------------------------------------------------------------------------

const DATA_SOURCES = process.env.DATA_SOURCES_BASE_URL ?? "http://127.0.0.1:8001";
const AI_ANALYST = process.env.AI_ANALYST_BASE_URL ?? "http://127.0.0.1:8002";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} → ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// data_sources — Soil Health
// ---------------------------------------------------------------------------

export interface SoilHealthResponse {
  soil_health_parameters?: Record<string, any>;
  farmer_details?: Record<string, any>;
  fertilizer_recommendations?: any[];
  _metadata?: Record<string, any>;
  [key: string]: any;
}

export async function fetchSoilHealth(phoneNumber: string): Promise<SoilHealthResponse> {
  return postJson<SoilHealthResponse>(`${DATA_SOURCES}/soil-health`, {
    phone_number: phoneNumber,
  });
}

// ---------------------------------------------------------------------------
// data_sources — Weather (current)
// ---------------------------------------------------------------------------

export interface CurrentWeatherResponse {
  location: Record<string, any>;
  current: {
    temp_c: number;
    feels_like_c: number;
    humidity: number;
    wind_kph: number;
    wind_dir: string;
    condition_text: string;
    precip_mm: number;
    [key: string]: any;
  };
}

export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeatherResponse> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return getJson<CurrentWeatherResponse>(`${DATA_SOURCES}/weather/current?${params}`);
}

// ---------------------------------------------------------------------------
// data_sources — Weather (forecast)
// ---------------------------------------------------------------------------

export interface ForecastDayResponse {
  date: string;
  avg_temp_c: number;
  total_precip_mm: number;
  daily_chance_of_rain: number;
  avg_humidity: number;
  condition_text: string;
  max_wind_kph: number;
  [key: string]: any;
}

export interface WeatherForecastResponse {
  location: Record<string, any>;
  forecast_days: ForecastDayResponse[];
  alerts: any[];
}

export async function fetchWeatherForecast(lat: number, lon: number, days: number = 7): Promise<WeatherForecastResponse> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), days: String(days) });
  return getJson<WeatherForecastResponse>(`${DATA_SOURCES}/weather/forecast?${params}`);
}

// ---------------------------------------------------------------------------
// ai_analyst — Analyse
// ---------------------------------------------------------------------------

export interface AnalysePayload {
  expected_language: string;
  soil: {
    nitrogen_status: string;
    phosphorus_status: string;
    potassium_status: string;
    ph_level: number;
    organic_matter: string;
    soil_moisture_percent?: number | null;
  };
  weather: {
    current_temperature_celsius: number;
    current_humidity_percent: number;
    current_condition: string;
    current_wind_kmh?: number | null;
    forecast: {
      day_offset: number;
      condition: string;
      rain_probability_percent: number;
      temperature_celsius: number;
      humidity_percent: number;
      rainfall_mm?: number | null;
    }[];
  };
  crop: {
    crop_name: string;
    variety?: string | null;
    sowing_date: string;
    farm_size_acres: number;
    irrigation_type: string;
    notes?: string | null;
  };
}

export interface AnalystReportResponse {
  greeting: string;
  crop_stage: string;
  situation_summary: string;
  alerts: any[];
  action_items: any[];
  fertilizer_recommendation: any | null;
  irrigation_recommendation: string | null;
  pest_disease_watch: string[];
  full_advisory: string;
}

export async function fetchAnalysis(payload: AnalysePayload): Promise<AnalystReportResponse> {
  return postJson<AnalystReportResponse>(`${AI_ANALYST}/api/v1/analyse`, payload);
}
