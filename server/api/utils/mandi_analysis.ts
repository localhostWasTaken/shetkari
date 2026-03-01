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

async function getMandiAnalysisForProduct(location: GeoLocation, language: SupportedLanguages, productId: string): Promise<string> {
  // waiting for anuj to implement this
  // for now, return some dummy data
  await new Promise((resolve) => setTimeout(resolve, 100)); // simulate async delay
  return `kya re lukkhe "${productId}" ki mandi analysis chahiye? muh me lena padega`;
}

export { getMandiProductsForUser, getMandiAnalysisForProduct };