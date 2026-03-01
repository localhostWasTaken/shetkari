import { SupportedLanguages } from "../entities/users";

const DATA_SOURCES_BASE_URL = process.env.DATA_SOURCES_BASE_URL ?? "http://127.0.0.1:8001";

/** Number of commodities to return per page. */
const PAGE_SIZE = 9;

/** Map SupportedLanguages enum code to the full language name the Python API expects. */
const LANGUAGE_NAME: Record<SupportedLanguages, string> = {
  [SupportedLanguages.ENGLISH]: "English",
  [SupportedLanguages.HINDI]: "Hindi",
  [SupportedLanguages.MARATHI]: "Marathi",
};

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

interface ProductFromMandi {
  id: string;   // original English commodity name (used as the stable key for /best-rates lookups)
  name: string; // translated commodity name in the user's language
}

// Shape returned by data_sources GET /mandi/commodities
interface MandiCommoditiesResponse {
  success: boolean;
  location: { latitude: number; longitude: number; state: string | null; district: string | null };
  commodities: { id: string; name: string }[];
  total: number;
  filters: Record<string, string>;
}

/**
 * Fetch all commodities available at the farmer's location from the data_sources
 * microservice, translated into their preferred language, and return one page of results.
 *
 * Pagination is CLIENT-SIDE: the full list is fetched once and sliced per page.
 *
 * @param location  Farmer's GPS coordinates.
 * @param language  The farmer's preferred language (used for Gemini translation).
 * @param page      1-indexed page number.
 * @returns         A slice of ProductFromMandi[], or [] if the page is out of range.
 */
async function getMandiProductsForUser(
  location: GeoLocation,
  language: SupportedLanguages,
  page: number,
): Promise<ProductFromMandi[]> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    expected_language: LANGUAGE_NAME[language] ?? "English",
  });

  const res = await fetch(`${DATA_SOURCES_BASE_URL}/mandi/commodities?${params}`);
  if (!res.ok) {
    throw new Error(`data_sources /mandi/commodities → ${res.status} ${res.statusText}`);
  }

  const data: MandiCommoditiesResponse = await res.json();
  const all = data.commodities; // already [{id, name}, ...]

  // Paginate: page is 1-indexed
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  return all.slice(startIndex, endIndex); // returns [] when page is out of range
}

// Shape returned by data_sources GET /mandi/best-rates
interface BestRatesResponse {
  success: boolean;
  commodity: string;
  location: { latitude: number | null; longitude: number | null; state: string | null; district: string | null };
  best_mandi: { market: string; district: string; state: string; modal_price: number; distance_km?: number } | null;
  top_markets: Array<{ market: string; district: string; state: string; modal_price: number; min_price: number; max_price: number; distance_km?: number }>;
  recommendations: string[];
  statistics: { average_price: number; highest_price: number; lowest_price: number };
  total_markets_analyzed: number;
}

const AI_ANALYST_BASE_URL = process.env.AI_ANALYST_BASE_URL ?? "http://127.0.0.1:8000";

/**
 * Fetch best mandi rates for a commodity at the farmer's location, then pass
 * the raw data to the AI analyst service which generates a concise, multilingual
 * advisory via Gemini.
 *
 * @param location   Farmer's GPS coordinates.
 * @param language   Farmer's preferred language (passed to Gemini for translation).
 * @param productId  Original English commodity name (the `id` from ProductFromMandi).
 * @returns          AI-generated advisory string in the farmer's language.
 */
async function getMandiAnalysisForProduct(
  location: GeoLocation,
  language: SupportedLanguages,
  productId: string,
): Promise<string> {
  // Step 1: fetch raw best-rates data from data_sources
  const params = new URLSearchParams({
    commodity: productId,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    radius_km: "150",
  });

  const priceRes = await fetch(`${DATA_SOURCES_BASE_URL}/mandi/best-rates?${params}`);

  if (priceRes.status === 404) {
    return `No mandi price data found for *${productId}* near your location.`;
  }
  if (!priceRes.ok) {
    throw new Error(`data_sources /mandi/best-rates → ${priceRes.status} ${priceRes.statusText}`);
  }

  const data: BestRatesResponse = await priceRes.json();

  // Step 2: send raw data + language to the AI analyst for multilingual advisory
  const aiPayload = {
    commodity: data.commodity,
    state: data.location.state,
    district: data.location.district,
    best_mandi: data.best_mandi ?? null,
    top_markets: data.top_markets.slice(0, 5),
    statistics: data.statistics ?? null,
    recommendations: data.recommendations,
    total_markets_analyzed: data.total_markets_analyzed,
    expected_language: LANGUAGE_NAME[language] ?? "English",
  };

  const aiRes = await fetch(`${AI_ANALYST_BASE_URL}/api/v1/mandi-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aiPayload),
  });

  if (!aiRes.ok) {
    throw new Error(`ai_analyst /api/v1/mandi-analysis → ${aiRes.status} ${aiRes.statusText}`);
  }

  const aiData = await aiRes.json() as { advisory: string };
  return aiData.advisory;
}

export { getMandiProductsForUser, getMandiAnalysisForProduct };