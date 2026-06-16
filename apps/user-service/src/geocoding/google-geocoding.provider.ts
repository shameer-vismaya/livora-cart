import { Injectable, Logger } from '@nestjs/common';
import { AddressInput, GeoPoint, GeocodingProvider } from './geocoding.provider';
import { loadAppEnv } from '../config';

/**
 * Google Geocoding API provider. With no API key (dev/host without keys), returns
 * a deterministic stub point and logs — so address flows work without billing.
 */
@Injectable()
export class GoogleGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger(GoogleGeocodingProvider.name);
  private readonly env = loadAppEnv();

  async geocode(addr: AddressInput): Promise<GeoPoint> {
    if (!this.env.GEOCODING_API_KEY) {
      this.logger.warn('[DEV] no GEOCODING_API_KEY — returning stub coordinates');
      return { lat: 0, lon: 0 };
    }
    const q = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country ?? 'IN']
      .filter(Boolean)
      .join(', ');
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', this.env.GEOCODING_API_KEY);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (json.status !== 'OK' || !json.results.length) {
      this.logger.warn(`geocode returned ${json.status} for "${q}"`);
      return { lat: 0, lon: 0 };
    }
    const loc = json.results[0].geometry.location;
    return { lat: loc.lat, lon: loc.lng };
  }
}
