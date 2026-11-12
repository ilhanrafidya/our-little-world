/**
 * Mendukung:
 *  - https://open.spotify.com/track/{id}?si=...
 *  - https://open.spotify.com/intl-id/track/{id}
 *  - https://open.spotify.com/embed/track/{id}
 *  - spotify:track:{id}
 */
const URL_RE = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2,})?\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})(?:[/?#].*)?$/i;
const URI_RE = /^spotify:track:([A-Za-z0-9]{22})$/;

export function parseSpotifyTrackId(input: string): string | null {
  const s = input.trim();
  return s.match(URL_RE)?.[1] ?? s.match(URI_RE)?.[1] ?? null;
}

export function normalizeSpotifyTrackUrl(input: string): string | null {
  const id = parseSpotifyTrackId(input);
  return id ? `https://open.spotify.com/track/${id}` : null;
}

export function spotifyEmbedUrl(input: string): string | null {
  const id = parseSpotifyTrackId(input);
  return id ? `https://open.spotify.com/embed/track/${id}?utm_source=generator` : null;
}
