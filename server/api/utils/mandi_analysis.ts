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

/**
 * Fetch best mandi rates for a commodity at the farmer's location and return
 * a formatted, human-readable analysis string suitable for WhatsApp.
 *
 * @param location  Farmer's GPS coordinates (forwarded to OpenCage + nearby sort).
 * @param language  Currently unused — prices are numbers so no translation needed.
 * @param productId The original English commodity name (the `id` from ProductFromMandi).
 */
async function getMandiAnalysisForProduct(
  location: GeoLocation,
  language: SupportedLanguages,
  productId: string,
): Promise<string> {
  const params = new URLSearchParams({
    commodity: productId,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    radius_km: "150",
  });

  const res = await fetch(`${DATA_SOURCES_BASE_URL}/mandi/best-rates?${params}`);

  if (res.status === 404) {
    return `No mandi price data found for *${productId}* near your location.`;
  }
  if (!res.ok) {
    throw new Error(`data_sources /mandi/best-rates → ${res.status} ${res.statusText}`);
  }

  const data: BestRatesResponse = await res.json();
  const lines: string[] = [];

  // Header
  lines.push(`📊 *Mandi Rates: ${data.commodity}*`);
  if (data.location.district || data.location.state) {
    lines.push(`📍 ${[data.location.district, data.location.state].filter(Boolean).join(", ")}`);
  }
  lines.push("");

  // Best mandi
  if (data.best_mandi) {
    const b = data.best_mandi;
    const dist = b.distance_km != null ? ` (${b.distance_km.toFixed(0)} km away)` : "";
    lines.push(`🏆 *Best Mandi:* ${b.market}, ${b.district}${dist}`);
    lines.push(`   ₹${b.modal_price.toFixed(0)} / quintal`);
    lines.push("");
  }

  // Top markets (up to 3)
  if (data.top_markets?.length) {
    lines.push("📈 *Nearby Markets:*");
    data.top_markets.slice(0, 3).forEach((m, i) => {
      const dist = m.distance_km != null ? ` · ${m.distance_km.toFixed(0)} km` : "";
      lines.push(`${i + 1}. ${m.market} — ₹${m.modal_price.toFixed(0)}${dist}`);
    });
    lines.push("");
  }

  // Price stats
  const s = data.statistics;
  if (s) {
    lines.push(`📉 Low ₹${s.lowest_price.toFixed(0)}  |  📈 High ₹${s.highest_price.toFixed(0)}  |  Avg ₹${s.average_price.toFixed(0)}`);
    lines.push("");
  }

  // Recommendations
  if (data.recommendations?.length) {
    lines.push("💡 *Tips:*");
    data.recommendations.slice(0, 2).forEach((r) => lines.push(`• ${r}`));
  }

  return lines.join("\n");
}

export { getMandiProductsForUser, getMandiAnalysisForProduct };