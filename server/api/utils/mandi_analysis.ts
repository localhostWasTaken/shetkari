import { SupportedLanguages } from "../entities/users";

interface ProductFromMandi{
  id: string;
  name: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

async function getMandiProductsForUser(location: GeoLocation, language: SupportedLanguages, page: number): Promise<ProductFromMandi[]> {

  // waiting for anuj to implement this
  // for now, return some dummy data
  await new Promise((resolve) => setTimeout(resolve, 100)); // simulate async delay
  if (page === 1) {
    return [
      { id: '1', name: 'wheat' },
      { id: '2', name: 'rice' },
      { id: '3', name: 'corn' },
      { id: '4', name: 'barley' },
      { id: '5', name: 'soybean' },
      { id: '6', name: 'cotton' },
      { id: '7', name: 'sugarcane' },
      { id: '8', name: 'potato' },
      { id: '9', name: 'onion' },
  ];
  } else {
    return [
      { id: '10', name: 'tomato' },
      { id: '11', name: 'chili' },
    ];
  }
}

async function getMandiAnalysisForProduct(location: GeoLocation, language: SupportedLanguages, productId: string): Promise<string> {
  // waiting for anuj to implement this
  // for now, return some dummy data
  await new Promise((resolve) => setTimeout(resolve, 100)); // simulate async delay
  return `kya re lukkhe "${productId}" ki mandi analysis chahiye? muh me lena padega`;
}

export { getMandiProductsForUser, getMandiAnalysisForProduct };