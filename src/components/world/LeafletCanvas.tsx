'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Memory, MemoryStatus } from '@/types/memory';
import { TILE_ATTRIBUTION, TILE_URLS, type ThemeTokens } from '@/lib/theme';
import { useWorld } from '@/store/world-store';

/**
 * Implementasi Peta 2D. HANYA di-load di browser lewat MapView (dynamic, ssr:false)
 * karena Leaflet mengakses window saat di-import.
 */

const HEART =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.6-9.1C.9 8 2.9 4.5 6.4 4.5c2.1 0 3.6 1.2 4.4 2.5h2.4c.8-1.3 2.3-2.5 4.4-2.5 3.5 0 5.5 3.5 4 6.9-2.1 4.5-9.6 9.1-9.6 9.1z"/></svg>';
const STAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';

const iconCache = new Map<string, L.DivIcon>();
function pinIcon(status: MemoryStatus, selected: boolean): L.DivIcon {
  const key = `${status}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'olw-pin-wrap',
      html: `<div class="olw-pin olw-pin--${status}${selected ? ' is-selected' : ''}">${status === 'visited' ? HEART : STAR}</div>`,
      iconSize: [38, 46],
      iconAnchor: [19, 44],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function Controller({ visible }: { visible: boolean }) {
  const map = useMap();
  const request = useWorld((s) => s.mapRequest);
  const setMapView = useWorld((s) => s.setMapView);
  const backToGlobe = useWorld((s) => s.backToGlobe);
  const select = useWorld((s) => s.select);

  // Permintaan baru dari globe → "mendarat" di kota tujuan
  useEffect(() => {
    if (!request) return;
    map.invalidateSize();
    map.setView(request.center, request.bounds ? 10 : Math.max((request.zoom ?? 13) - 2, 3), { animate: false });
    const t = setTimeout(() => {
      if (request.bounds) {
        map.flyToBounds(request.bounds, { padding: [70, 70], maxZoom: 16, duration: 1.1 });
      } else {
        map.flyTo(request.center, request.zoom ?? 13, { duration: 1.1 });
      }
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  // Ukuran peta harus dihitung ulang setiap kali layer peta tampil lagi
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(t);
  }, [visible, map]);

  useMapEvents({
    moveend() {
      const c = map.getCenter();
      setMapView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    },
    zoomend() {
      // Zoom out jauh → kembali ke globe (kecuali sedang memilih titik)
      if (visible && map.getZoom() <= 3 && !useWorld.getState().editor.picking) backToGlobe();
    },
    click() {
      select(null);
    },
  });

  return null;
}

export interface LeafletCanvasProps {
  memories: Memory[];
  theme: ThemeTokens;
  visible: boolean;
}

export default function LeafletCanvas({ memories, theme, visible }: LeafletCanvasProps) {
  const selectedId = useWorld((s) => s.selectedMemoryId);
  const select = useWorld((s) => s.select);
  const initial = useWorld.getState().mapRequest;
  const tileUrl = TILE_URLS[theme.tiles];

  return (
    <MapContainer
      center={initial?.center ?? [-6.2, 106.8]}
      zoom={initial?.zoom ?? 12}
      minZoom={2}
      maxZoom={19}
      zoomControl={false}
      attributionControl={false}
      worldCopyJump
      className={`olw-map olw-map--${theme.tiles}`}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer key={tileUrl} url={tileUrl} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={20} />
      <AttributionControl position="bottomleft" prefix={false} />
      <Controller visible={visible} />
      {memories.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.status, m.id === selectedId)}
          zIndexOffset={m.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => select(m.id) }}
          title={m.title}
        />
      ))}
    </MapContainer>
  );
}
