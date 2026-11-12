'use client';

import { spotifyEmbedUrl } from '@/lib/spotify';

/** Pemutar resmi Spotify (compact). Penuh jika login Spotify di browser; selain itu cuplikan ±30 dtk. */
export default function SpotifyEmbed({ url }: { url: string }) {
  const src = spotifyEmbedUrl(url);
  if (!src) return null;
  return (
    <div className="space-y-1.5">
      <iframe
        title="Our song"
        src={src}
        width="100%"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="block rounded-xl border-0"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-cream-50/70 underline-offset-2 hover:underline"
      >
        Open full song in Spotify →
      </a>
    </div>
  );
}
