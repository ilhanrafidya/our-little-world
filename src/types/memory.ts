export type MemoryStatus = 'visited' | 'wishlist';

export interface MemoryPhoto {
  url: string;
  pathname: string;
  width: number;
  height: number;
}

export interface Memory {
  id: string;
  title: string;
  city: string;
  /** lower(trim(city)) — kunci pengelompokan titik kota di Globe */
  cityKey: string;
  country: string | null;
  lat: number;
  lng: number;
  status: MemoryStatus;
  /** 'YYYY-MM-DD' atau null (wishlist boleh tanpa tanggal) */
  memoryDate: string | null;
  story: string | null;
  /** URL track Spotify yang sudah dinormalisasi: https://open.spotify.com/track/{id} */
  spotifyUrl: string | null;
  photo: MemoryPhoto | null;
  createdAt: string;
  updatedAt: string;
}
