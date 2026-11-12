import type { Memory, MemoryStatus } from '@/types/memory';

export type LatLngTuple = [number, number];
export type Bounds = [LatLngTuple, LatLngTuple];

/** Titik kota di Globe 3D = kumpulan spot yang punya city_key sama. */
export interface City {
  key: string;
  name: string;
  country: string | null;
  /** centroid semua spot di kota ini */
  lat: number;
  lng: number;
  /** visited jika minimal satu spot visited */
  status: MemoryStatus;
  count: number;
  /** tanggal kenangan paling awal (YYYY-MM-DD) — untuk urutan journey */
  firstDate: string | null;
  bounds: Bounds;
}

export interface Arc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  kind: 'journey' | 'wish';
  /** urutan arc di journey (0 = kota ke-1 → ke-2) */
  index: number;
}

export function groupByCity(memories: Memory[]): City[] {
  const groups = new Map<string, Memory[]>();
  for (const m of memories) {
    const list = groups.get(m.cityKey);
    if (list) list.push(m);
    else groups.set(m.cityKey, [m]);
  }

  return [...groups.entries()].map(([key, ms]) => {
    let lat = 0;
    let lng = 0;
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const m of ms) {
      lat += m.lat;
      lng += m.lng;
      minLat = Math.min(minLat, m.lat);
      maxLat = Math.max(maxLat, m.lat);
      minLng = Math.min(minLng, m.lng);
      maxLng = Math.max(maxLng, m.lng);
    }
    const dates = ms
      .map((m) => m.memoryDate)
      .filter((d): d is string => !!d)
      .sort();

    return {
      key,
      name: ms[0]!.city,
      country: ms.find((m) => m.country)?.country ?? null,
      lat: lat / ms.length,
      lng: lng / ms.length,
      status: ms.some((m) => m.status === 'visited') ? 'visited' : 'wishlist',
      count: ms.length,
      firstDate: dates[0] ?? null,
      bounds: [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
    } satisfies City;
  });
}

/** Kota visited, urut kronologis (yang tanpa tanggal di akhir). */
export function buildJourney(cities: City[]): City[] {
  return cities
    .filter((c) => c.status === 'visited')
    .sort((a, b) => {
      if (a.firstDate && b.firstDate) return a.firstDate.localeCompare(b.firstDate);
      if (a.firstDate) return -1;
      if (b.firstDate) return 1;
      return a.name.localeCompare(b.name);
    });
}

export function buildArcs(journey: City[], cities: City[]): Arc[] {
  const arcs: Arc[] = [];
  for (let i = 0; i < journey.length - 1; i++) {
    const a = journey[i]!;
    const b = journey[i + 1]!;
    if (haversineKm(a, b) < 1) continue;
    arcs.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng, kind: 'journey', index: i });
  }
  // Garis putus-putus dari kota terakhir yang dikunjungi ke setiap wishlist
  const last = journey[journey.length - 1];
  if (last) {
    cities
      .filter((c) => c.status === 'wishlist' && haversineKm(c, last) >= 1)
      .forEach((c, i) =>
        arcs.push({ startLat: last.lat, startLng: last.lng, endLat: c.lat, endLng: c.lng, kind: 'wish', index: i }),
      );
  }
  return arcs;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestCity(lat: number, lng: number, cities: City[], maxKm: number): City | null {
  let best: City | null = null;
  let bestKm = Infinity;
  for (const c of cities) {
    const km = haversineKm({ lat, lng }, c);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return bestKm <= maxKm ? best : null;
}
