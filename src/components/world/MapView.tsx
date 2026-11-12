'use client';

import dynamic from 'next/dynamic';
import type { LeafletCanvasProps } from './LeafletCanvas';

/** Wrapper SSR-safe untuk Leaflet (mengakses window saat import). */
const LeafletCanvas = dynamic(() => import('./LeafletCanvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/5" />,
});

export default function MapView(props: LeafletCanvasProps) {
  return <LeafletCanvas {...props} />;
}
