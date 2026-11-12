'use client';

/**
 * Mesin animasi Play Journey (berjalan di atas instance react-globe.gl).
 *
 * Alur:  intro → tiba di kota 1 → [lepas landas → perjalanan → tiba] × n → outro
 * - Jarak > 200 km: pesawat terbang melengkung; ≤ 200 km: mobil menempel di permukaan.
 * - Kamera mengikuti kendaraan (dekat untuk mobil, naik-turun untuk pesawat).
 * - Rute "tergambar" di belakang kendaraan (Line2 tebal), rute lama tetap menyala.
 * - Mendukung jeda, skip, dan berhenti kapan saja.
 */

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { GlobeMethods } from 'react-globe.gl';
import { haversineKm, type City } from '@/lib/geo';
import { useWorld } from '@/store/world-store';
import { sound } from '@/lib/sound';

export const CAR_MAX_KM = 200;

type Pov = { lat: number; lng: number; altitude: number };
type Vec = [number, number, number];

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function toVec(lat: number, lng: number): Vec {
  const p = lat * D2R;
  const l = lng * D2R;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

/** Interpolasi great-circle (jalur terpendek di permukaan bumi). */
function slerp(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) {
  const va = toVec(a.lat, a.lng);
  const vb = toVec(b.lat, b.lng);
  const dot = clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1);
  const w = Math.acos(dot);
  if (w < 1e-6) return { lat: a.lat, lng: a.lng };
  const s = Math.sin(w);
  const k1 = Math.sin((1 - t) * w) / s;
  const k2 = Math.sin(t * w) / s;
  const v: Vec = [va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2];
  return { lat: Math.asin(clamp(v[2], -1, 1)) * R2D, lng: Math.atan2(v[1], v[0]) * R2D };
}

function centroid(cities: City[]) {
  const v: Vec = [0, 0, 0];
  for (const c of cities) {
    const u = toVec(c.lat, c.lng);
    v[0] += u[0];
    v[1] += u[1];
    v[2] += u[2];
  }
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return { lat: Math.asin(v[2] / n) * R2D, lng: Math.atan2(v[1], v[0]) * R2D };
}

// ── Ikon kendaraan (digambar di canvas, menghadap ke atas) ─────────
function vehicleTexture(kind: 'plane' | 'car', accent: string): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(S / 2, S / 2);
  g.shadowColor = accent;
  g.shadowBlur = 28;
  g.fillStyle = '#fffaf2';
  g.strokeStyle = 'rgba(23,23,58,0.35)';
  g.lineWidth = 3;

  if (kind === 'plane') {
    g.beginPath();
    g.moveTo(0, -92); // hidung
    g.bezierCurveTo(10, -84, 12, -60, 12, -40);
    g.lineTo(12, -18);
    g.lineTo(88, 18); // sayap kanan
    g.lineTo(88, 32);
    g.lineTo(12, 14);
    g.lineTo(10, 58);
    g.lineTo(34, 78); // ekor kanan
    g.lineTo(34, 88);
    g.lineTo(0, 78);
    g.lineTo(-34, 88);
    g.lineTo(-34, 78);
    g.lineTo(-10, 58);
    g.lineTo(-12, 14);
    g.lineTo(-88, 32);
    g.lineTo(-88, 18);
    g.lineTo(-12, -18);
    g.lineTo(-12, -40);
    g.bezierCurveTo(-12, -60, -10, -84, 0, -92);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.stroke();
  } else {
    const w = 64;
    const h = 120;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, 22);
    g.fill();
    g.shadowBlur = 0;
    g.stroke();
    g.fillStyle = 'rgba(23,23,58,0.75)'; // kaca depan & belakang
    g.beginPath();
    g.roundRect(-w / 2 + 9, -h / 2 + 22, w - 18, 22, 6);
    g.fill();
    g.beginPath();
    g.roundRect(-w / 2 + 11, h / 2 - 34, w - 22, 14, 5);
    g.fill();
    g.fillStyle = accent; // lampu depan
    g.beginPath();
    g.arc(-18, -h / 2 + 8, 5, 0, Math.PI * 2);
    g.arc(18, -h / 2 + 8, 5, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function shadowTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

// ── Engine ─────────────────────────────────────────────────────────
export interface JourneyCallbacks {
  /** dipanggil setiap kamera berpindah (untuk uniform shader siang/malam) */
  onPov: (pov: Pov) => void;
  /** efek gelombang cahaya saat tiba di kota */
  onArrive: (city: City) => void;
}

export function runJourney(
  g: GlobeMethods,
  journey: City[],
  accent: string,
  cb: JourneyCallbacks,
): { cancel: () => void; done: Promise<void> } {
  let cancelled = false;
  let lastSkip = useWorld.getState().journey.skipNonce;
  const scene = g.scene();
  const trails: Line2[] = [];
  const textures: THREE.Texture[] = [];
  const st = () => useWorld.getState();
  const setJ = st().setJourney;

  const isCancelled = () => cancelled || !st().journey.playing;
  const consumeSkip = () => {
    const n = st().journey.skipNonce;
    if (n !== lastSkip) {
      lastSkip = n;
      return true;
    }
    return false;
  };

  /** Loop per frame; berhenti sementara saat dijeda, langsung selesai saat di-skip. */
  function animate(duration: number, onFrame?: (t: number) => void, skippable = true): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
      let last = performance.now();
      const step = (now: number) => {
        if (isCancelled()) return resolve();
        const dt = Math.min(now - last, 100);
        last = now;
        if (!st().journey.paused) elapsed += dt;
        if (skippable && consumeSkip()) elapsed = duration;
        const t = Math.min(1, elapsed / duration);
        onFrame?.(t);
        if (t >= 1) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  const setPov = (pov: Pov) => {
    g.pointOfView(pov, 0);
    cb.onPov(pov);
  };

  function flyTo(to: Pov, duration: number, skippable = false) {
    const from = g.pointOfView();
    return animate(
      duration,
      (t) => {
        const e = easeInOut(t);
        const p = slerp(from, to, e);
        setPov({ lat: p.lat, lng: p.lng, altitude: lerp(from.altitude, to.altitude, e) });
      },
      skippable,
    );
  }

  /** Garis rute dibuat sekali; ditampilkan bertahap (instanceCount) agar ringan di iPhone. */
  function makeTrail(points: number[]): Line2 {
    const mat = new LineMaterial({ color: accent, linewidth: 3, transparent: true, opacity: 0.95, depthWrite: false });
    const size = new THREE.Vector2();
    (g.renderer() as THREE.WebGLRenderer).getSize(size);
    mat.resolution.set(size.x, size.y);
    const geo = new LineGeometry();
    geo.setPositions(points);
    geo.instanceCount = 0;
    const line = new Line2(geo, mat);
    line.renderOrder = 10;
    line.frustumCulled = false;
    scene.add(line);
    trails.push(line);
    return line;
  }

  async function arrive(city: City, index: number, carMode: boolean) {
    await flyTo({ lat: city.lat, lng: city.lng, altitude: carMode ? 0.14 : 0.32 }, 900);
    if (isCancelled()) return;
    cb.onArrive(city);
    setJ({ phase: 'arrive', index, vehicle: null });
    await animate(2800);
  }

  async function travel(a: City, b: City, index: number) {
    const km = haversineKm(a, b);
    const kind: 'plane' | 'car' = km > CAR_MAX_KM ? 'plane' : 'car';
    setJ({ phase: 'travel', index, vehicle: kind });

    const flightAlt = kind === 'plane' ? clamp(km / 9000, 0.04, 0.35) : 0.003;
    const camBase = kind === 'plane' ? 0.42 : 0.13;
    const camPeak = kind === 'plane' ? clamp(km / 3500, 0.3, 1.9) : clamp(km / 450, 0.03, 0.2);
    const duration = kind === 'plane' ? clamp(3200 + km * 0.45, 4000, 8000) : clamp(2800 + km * 12, 3000, 5000);
    const baseScale = kind === 'plane' ? 0.062 : 0.048;

    const pos = (u: number) => {
      const p = slerp(a, b, u);
      const alt = kind === 'plane' ? 0.004 + flightAlt * Math.sin(Math.PI * u) : flightAlt;
      return { ...p, alt };
    };

    // Rute di-sampling sekali di awal
    const SAMPLES = 180;
    const pts: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const p = pos(i / SAMPLES);
      const xyz = g.getCoords(p.lat, p.lng, p.alt);
      pts.push(xyz.x, xyz.y, xyz.z);
    }
    const trail = makeTrail(pts);

    // Kendaraan + bayangan di permukaan (memberi kesan melayang)
    const tex = vehicleTexture(kind, accent);
    textures.push(tex);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0 }),
    );
    sprite.renderOrder = 20;
    scene.add(sprite);

    const shadowTex = shadowTexture();
    textures.push(shadowTex);
    const shadow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: shadowTex, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0 }),
    );
    shadow.renderOrder = 15;
    if (kind === 'plane') scene.add(shadow);

    // lepas landas: kamera sedikit naik di kota asal
    sound.whoosh();
    await flyTo({ lat: a.lat, lng: a.lng, altitude: camBase }, 700);

    const camera = g.camera() as THREE.Camera;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    let heading: number | null = null;

    await animate(duration, (raw) => {
      const u = easeInOut(raw);
      const p = pos(u);
      const xyz = g.getCoords(p.lat, p.lng, p.alt);
      sprite.position.set(xyz.x, xyz.y, xyz.z);

      // muncul & menghilang halus + sedikit membesar di tengah perjalanan
      const fade = Math.min(1, raw / 0.08, (1 - raw) / 0.08);
      const lift = kind === 'plane' ? 0.85 + 0.15 * Math.sin(Math.PI * u) : 1;
      const sc = baseScale * lift * (0.7 + 0.3 * fade);
      sprite.scale.set(sc, sc, 1);
      (sprite.material as THREE.SpriteMaterial).opacity = fade;

      if (kind === 'plane') {
        const ground = g.getCoords(p.lat, p.lng, 0.001);
        shadow.position.set(ground.x, ground.y, ground.z);
        const sh = baseScale * (1.1 - 0.4 * Math.sin(Math.PI * u));
        shadow.scale.set(sh, sh * 0.6, 1);
        (shadow.material as THREE.SpriteMaterial).opacity = fade * (0.55 - 0.3 * Math.sin(Math.PI * u));
      }

      // jejak rute sampai posisi kendaraan
      trail.geometry.instanceCount = Math.max(0, Math.floor(u * SAMPLES));

      // kamera sedikit tertinggal → kendaraan terlihat melaju di layar
      const cu = Math.max(0, u - 0.05);
      const cp = slerp(a, b, cu);
      setPov({ lat: cp.lat, lng: cp.lng, altitude: camBase + camPeak * Math.sin(Math.PI * u) });

      // arah hadap (diperhalus agar tidak bergetar)
      const ahead = pos(Math.min(1, u + 0.015));
      const xyz2 = g.getCoords(ahead.lat, ahead.lng, ahead.alt);
      v1.set(xyz.x, xyz.y, xyz.z).project(camera);
      v2.set(xyz2.x, xyz2.y, xyz2.z).project(camera);
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      if (Math.abs(dx) + Math.abs(dy) > 1e-5) {
        const target = Math.atan2(dy, dx) - Math.PI / 2;
        if (heading === null) heading = target;
        else {
          let diff = target - heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          heading += diff * 0.18;
        }
        (sprite.material as THREE.SpriteMaterial).rotation = heading;
      }
    });

    trail.geometry.instanceCount = SAMPLES;
    scene.remove(sprite);
    scene.remove(shadow);
    sprite.material.dispose();
    shadow.material.dispose();
    await arrive(b, index, kind === 'car');
  }

  function cleanup() {
    for (const t of trails) {
      scene.remove(t);
      t.geometry.dispose();
      (t.material as LineMaterial).dispose();
    }
    trails.length = 0;
    textures.forEach((t) => t.dispose());
  }

  const done = (async () => {
    try {
      const first = journey[0];
      if (!first) return;

      // ── Intro ──
      setJ({ phase: 'intro', index: 0 });
      await flyTo({ lat: first.lat, lng: first.lng, altitude: 2.5 }, 1200);
      await animate(1700);
      if (isCancelled()) return;
      await flyTo({ lat: first.lat, lng: first.lng, altitude: 0.32 }, 2200);
      if (isCancelled()) return;
      cb.onArrive(first);
      setJ({ phase: 'arrive', index: 0, vehicle: null });
      await animate(2800);

      // ── Perjalanan antarkota ──
      let km = 0;
      for (let i = 1; i < journey.length; i++) {
        if (isCancelled()) return;
        km += haversineKm(journey[i - 1]!, journey[i]!);
        await travel(journey[i - 1]!, journey[i]!, i);
      }
      if (isCancelled()) return;

      // ── Outro ──
      setJ({
        phase: 'outro',
        vehicle: null,
        summary: {
          cities: journey.length,
          km: Math.round(km),
          memories: journey.reduce((n, c) => n + c.count, 0),
        },
      });
      const center = centroid(journey);
      await flyTo({ lat: center.lat, lng: center.lng, altitude: 2.6 }, 2400);
      await animate(5000);
    } finally {
      cleanup();
      if (!cancelled && st().journey.playing) st().stopJourney();
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
    done,
  };
}
