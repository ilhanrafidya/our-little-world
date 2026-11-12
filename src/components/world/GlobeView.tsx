'use client';

import dynamic from 'next/dynamic';
import type { GlobeCanvasProps } from './GlobeCanvas';

/**
 * Wrapper SSR-safe: three.js butuh window/WebGL, jadi GlobeCanvas hanya di-load di browser.
 * `ssr: false` wajib dipanggil dari Client Component (file ini 'use client').
 */
const GlobeCanvas = dynamic(() => import('./GlobeCanvas'), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

function GlobeSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-56 w-56 animate-pulse rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.18),rgba(255,255,255,0.03)_60%,transparent_70%)] shadow-[0_0_80px_rgba(255,122,156,0.25)]" />
    </div>
  );
}

export default function GlobeView(props: GlobeCanvasProps) {
  return <GlobeCanvas {...props} />;
}
