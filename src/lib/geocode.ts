/**
 * Helper lokasi di browser.
 * - getCurrentLocation: Geolocation API (butuh HTTPS + izin pengguna)
 * - reverseGeocode: tebak nama kota dari koordinat via OpenStreetMap Nominatim (gratis, tanpa API key).
 *   Best-effort: kalau gagal, form tetap bisa diisi manual.
 */

export function getCurrentLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser doesn’t support location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in Settings → Safari/Chrome → Location, or pick on the map.'
            : err.code === err.TIMEOUT
              ? 'Finding your location took too long. Try again or pick on the map.'
              : 'Couldn’t find your location. Try picking on the map.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ city: string | null; country: string | null }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`;
    // Nominatim mensyaratkan Referer → kirim origin situs ini
    const res = await fetch(url, { headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' });
    if (!res.ok) return { city: null, country: null };
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    const city = a.city ?? a.town ?? a.municipality ?? a.county ?? a.village ?? a.state ?? null;
    return { city: city ? city.replace(/^(Kota|Kabupaten|City of|Regency of) /, '') : null, country: a.country ?? null };
  } catch {
    return { city: null, country: null };
  }
}

export interface PlaceResult {
  id: string;
  name: string;
  /** keterangan singkat: jalan · kota · negara */
  detail: string;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined> & { osm_id?: number; osm_type?: string };
};

/**
 * Cari tempat berdasarkan nama (OpenStreetMap via Photon — gratis, tanpa API key).
 * Hasil diprioritaskan dekat posisi peta saat ini.
 */
export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: '6', lang: 'en' });
  if (near) {
    params.set('lat', near.lat.toFixed(4));
    params.set('lon', near.lng.toFixed(4));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
  if (!res.ok) throw new Error('Search is unavailable right now.');
  const data = (await res.json()) as { features?: PhotonFeature[] };

  return (data.features ?? []).map((f, i) => {
    const p = f.properties;
    const city = p.city ?? p.town ?? p.village ?? p.county ?? p.state ?? null;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const name = p.name ?? street ?? city ?? 'Unnamed place';
    const detail = [street && street !== name ? street : null, city && city !== name ? city : null, p.country]
      .filter(Boolean)
      .join(' · ');
    return {
      id: `${p.osm_type ?? ''}${p.osm_id ?? i}`,
      name,
      detail,
      city: city ? city.replace(/^(Kota|Kabupaten|City of|Regency of) /, '') : null,
      country: p.country ?? null,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    };
  });
}
