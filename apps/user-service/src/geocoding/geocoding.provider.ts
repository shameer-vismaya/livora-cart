export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface AddressInput {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface GeocodingProvider {
  geocode(addr: AddressInput): Promise<GeoPoint>;
}

/** DI token so the provider (Google / Mappls / stub) is swappable. */
export const GEOCODING_PROVIDER = 'GEOCODING_PROVIDER';
