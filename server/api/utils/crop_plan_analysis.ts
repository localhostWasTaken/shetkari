import { UUID } from "node:crypto";
import { CropPlan } from "../entities/crop_plan";
import { SupportedLanguages } from "../entities/users";
import UserModel from "../entities/users";
import {
  fetchSoilHealth,
  fetchCurrentWeather,
  fetchWeatherForecast,
  fetchAnalysis,
  type SoilHealthResponse,
  type CurrentWeatherResponse,
  type WeatherForecastResponse,
  type AnalysePayload,
} from "./service_clients";

// ---------------------------------------------------------------------------
// Language code → full name mapping (for the AI analyst expected_language)
// ---------------------------------------------------------------------------

const LANGUAGE_NAME_MAP: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "English",
  [SupportedLanguages.HINDI]: "Hindi",
  [SupportedLanguages.MARATHI]: "Marathi",
};

// ---------------------------------------------------------------------------
// Soil health → AI analyst SoilData mapping
// ---------------------------------------------------------------------------

/**
 * The soil health card returns `soil_parameters[]` — an array of parameter
 * objects like `{ name, value, unit, status }`.
 *
 * Status values from the HTML extractor icon mapping:
 *   "Adequate"                → "Normal"
 *   "Medium"                  → "Normal"
 *   "Deficient"               → "Deficient"
 *   "Critical / Highly Acidic"→ "Deficient"
 *   anything else             → "Normal" (safe fallback)
 */
function mapSoilStatus(raw: string): "Deficient" | "Normal" | "Excess" {
  const lower = raw.toLowerCase();
  if (lower.includes("deficient") || lower.includes("critical")) return "Deficient";
  if (lower.includes("excess") || lower.includes("high")) return "Excess";
  return "Normal"; // "Adequate", "Medium", unknown
}

function findSoilParam(params: any[], ...keywords: string[]): any | undefined {
  return params.find((p: any) => {
    const name = (p.name ?? "").toLowerCase();
    return keywords.some((kw) => name.includes(kw));
  });
}

function buildSoilPayload(soil: SoilHealthResponse): AnalysePayload["soil"] {
  const params: any[] = soil.soil_parameters ?? [];

  const nitrogen = findSoilParam(params, "nitrogen", "नाइट्रोजन");
  const phosphorus = findSoilParam(params, "phosphorus", "फॉस्फरस", "phosph");
  const potassium = findSoilParam(params, "potassium", "पोटैशियम", "potash");
  const phParam = findSoilParam(params, "ph", "पी.एच");
  const organic = findSoilParam(params, "organic", "कार्बनिक", "carbon");

  return {
    nitrogen_status: mapSoilStatus(nitrogen?.status ?? "Normal"),
    phosphorus_status: mapSoilStatus(phosphorus?.status ?? "Normal"),
    potassium_status: mapSoilStatus(potassium?.status ?? "Normal"),
    ph_level: typeof phParam?.value === "number" ? phParam.value : 7.0,
    organic_matter: mapOrganicMatter(organic?.status ?? "Medium"),
    soil_moisture_percent: null,
  };
}

function mapOrganicMatter(raw: string): "Low" | "Medium" | "High" {
  const lower = raw.toLowerCase();
  if (lower.includes("deficient") || lower.includes("critical") || lower.includes("low")) return "Low";
  if (lower.includes("excess") || lower.includes("high") || lower.includes("adequate")) return "High";
  return "Medium";
}

// ---------------------------------------------------------------------------
// Weather → AI analyst WeatherData mapping
// ---------------------------------------------------------------------------

function buildWeatherPayload(
  current: CurrentWeatherResponse,
  forecast: WeatherForecastResponse,
): AnalysePayload["weather"] {
  return {
    current_temperature_celsius: current.current.temp_c,
    current_humidity_percent: current.current.humidity,
    current_condition: current.current.condition_text,
    current_wind_kmh: current.current.wind_kph ?? null,
    forecast: forecast.forecast_days.map((day, index) => ({
      day_offset: index,
      condition: day.condition_text,
      rain_probability_percent: day.daily_chance_of_rain,
      temperature_celsius: day.avg_temp_c,
      humidity_percent: day.avg_humidity,
      rainfall_mm: day.total_precip_mm ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// CropPlan → AI analyst crop mapping
// ---------------------------------------------------------------------------

function buildCropPayload(cropPlan: CropPlan): AnalysePayload["crop"] {
  return {
    crop_name: cropPlan.cropName ?? "Unknown",
    sowing_date: cropPlan.sowingDate
      ? new Date(cropPlan.sowingDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    farm_size_acres: cropPlan.farmSizeAcres ?? 1,
    irrigation_type: cropPlan.irrigationMethod ?? "Rainfed",
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Fetch soil, weather, and crop data, then call the AI analyst service
 * to produce a multilingual farm advisory.
 *
 * @returns The `full_advisory` text from the AnalystReport.
 */
export async function cropPlanAnalysis(
  cropPlan: CropPlan,
  userId: UUID,
  language: SupportedLanguages,
): Promise<string> {
  // 1. Look up the user to get phone number and location
  const user = await UserModel.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (!user.phoneNumber) throw new Error("User has no phone number on file.");
  if (!user.location) throw new Error("User has no location on file.");

  const { latitude: lat, longitude: lon } = user.location;

  // 2. Fetch data in parallel: soil + current weather + forecast
  const [soilRaw, currentWeather, forecastWeather] = await Promise.all([
    fetchSoilHealth("+919867369695"), // Hardcoded, but can use user.phoneNumber when the soil card is ready to be user-specific
    fetchCurrentWeather(lat, lon),
    fetchWeatherForecast(lat, lon, 7),
  ]);

  // 3. Build the AI analyst payload
  const soil = soilRaw
    ? buildSoilPayload(soilRaw)
    : {
      nitrogen_status: "Normal" as const,
      phosphorus_status: "Normal" as const,
      potassium_status: "Normal" as const,
      ph_level: 7.0,
      organic_matter: "Medium" as const,
      soil_moisture_percent: null,
    };

  const weather = buildWeatherPayload(currentWeather, forecastWeather);
  const crop = buildCropPayload(cropPlan);

  const payload: AnalysePayload = {
    expected_language: LANGUAGE_NAME_MAP[language] ?? "English",
    soil,
    weather,
    crop,
  };

  // 4. Call the AI analyst
  const report = await fetchAnalysis(payload);

  // 5. Return the full advisory text
  return report.full_advisory;
}