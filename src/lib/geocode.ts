/**
 * Helper lokasi di browser.
 * - getCurrentLocation: Geolocation API (butuh HTTPS + izin pengguna)
 * - reverseGeocode: tebak nama kota dari koordinat via OpenStreetMap Nominatim (gratis, tanpa API key).
 *   Best-effort: kalau gagal, form tetap bisa diisi manual.
 */

export function getCurrentLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Browser ini tidak mendukung lokasi.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan di Pengaturan → Safari/Chrome → Lokasi, atau pilih titik di peta.'
            : err.code === err.TIMEOUT
              ? 'Lokasi terlalu lama ditemukan. Coba lagi atau pilih titik di peta.'
              : 'Lokasi tidak bisa ditemukan. Pilih titik di peta saja ya.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ city: string | null; country: string | null }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=id`;
    // Nominatim mensyaratkan Referer → kirim origin situs ini
    const res = await fetch(url, { headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' });
    if (!res.ok) return { city: null, country: null };
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    const city = a.city ?? a.town ?? a.municipality ?? a.county ?? a.village ?? a.state ?? null;
    return { city: city ? city.replace(/^(Kota|Kabupaten) /, '') : null, country: a.country ?? null };
  } catch {
    return { city: null, country: null };
  }
}
