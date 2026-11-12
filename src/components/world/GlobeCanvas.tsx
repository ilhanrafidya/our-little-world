'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { haversineKm, nearestCity, type Arc, type City } from '@/lib/geo';
import { subsolarPoint } from '@/lib/sun';
import type { ThemeTokens } from '@/lib/theme';
import { useWorld } from '@/store/world-store';
import { runJourney } from './journeyEngine';

/**
 * Implementasi Globe 3D. HANYA di-load di browser lewat GlobeView (dynamic, ssr:false)
 * karena three.js butuh window/WebGL.
 */

const TEX = 'https://cdn.jsdelivr.net/npm/three-globe/example/img';
const DAY_TEXTURE = `${TEX}/earth-blue-marble.jpg`;
const NIGHT_TEXTURE = `${TEX}/earth-night.jpg`;

const DEFAULT_POV = { lat: -2.5, lng: 117, altitude: 2.2 }; // Indonesia
const ENTER_MAP_ALTITUDE = 0.28;
const CITY_SNAP_KM = 400;

// Shader siang/malam: tekstur siang di sisi yang terkena matahari, lampu kota di sisi malam.
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  #define PI 3.141592653589793
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunPosition;
  uniform vec2 globeRotation;
  uniform float lookMode; // 0 = seluruh bumi siang, 1 = seluruh bumi malam (lampu kota), 2 = realistis (garis matahari)
  varying vec3 vNormal;
  varying vec2 vUv;

  float toRad(in float a) { return a * PI / 180.0; }

  vec3 Polar2Cartesian(in vec2 c) { // [lng, lat]
    float theta = toRad(90.0 - c.x);
    float phi = toRad(90.0 - c.y);
    return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
  }

  void main() {
    float invLon = toRad(globeRotation.x);
    float invLat = -toRad(globeRotation.y);
    mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
    mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
    vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
    float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 lights = texture2D(nightTexture, vUv);

    // Tampilan malam: benua tetap jelas (cahaya bulan kebiruan) + lampu kota menyala terang di seluruh dunia
    vec3 moonlit = dayColor.rgb * vec3(0.5, 0.6, 0.92) + vec3(0.02, 0.03, 0.07);
    float lum = max(max(lights.r, lights.g), lights.b);
    float glow = smoothstep(0.04, 0.45, lum);
    vec3 city = lights.rgb * 1.6 + vec3(1.0, 0.8, 0.45) * glow * 1.1;
    vec3 nightColor = min(moonlit * (1.0 - glow * 0.45) + city, vec3(1.0));

    float blendFactor;
    if (lookMode < 0.5) blendFactor = 1.0;
    else if (lookMode < 1.5) blendFactor = 0.0;
    else blendFactor = smoothstep(-0.2, 0.2, intensity);

    gl_FragColor = vec4(mix(nightColor, dayColor.rgb, blendFactor), 1.0);
  }
`;

type Controls = {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableDamping: boolean;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};


export interface GlobeCanvasProps {
  cities: City[];
  arcs: Arc[];
  journey: City[];
  theme: ThemeTokens;
}

export default function GlobeCanvas({ cities, arcs, journey, theme }: GlobeCanvasProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const busyRef = useRef(false); // sedang animasi kamera → abaikan ambang zoom
  const citiesRef = useRef(cities);
  citiesRef.current = cities;

  const mode = useWorld((s) => s.mode);
  const journeyState = useWorld((s) => s.journey);
  const enterMap = useWorld((s) => s.enterMap);
  const stopJourney = useWorld((s) => s.stopJourney);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ── ukuran layar (iOS: toolbar Safari mengubah tinggi) ──
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── material siang/malam ──
  const material = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const day = loader.load(DAY_TEXTURE);
    const night = loader.load(NIGHT_TEXTURE);
    // JANGAN set colorSpace = SRGB: ShaderMaterial custom tidak mengonversi balik ke sRGB,
    // sehingga warna jadi jauh lebih gelap. Biarkan nilai piksel lewat apa adanya.
    return new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: day },
        nightTexture: { value: night },
        sunPosition: { value: new THREE.Vector2() },
        globeRotation: { value: new THREE.Vector2() },
        lookMode: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });
  }, []);

  // Posisi matahari diperbarui tiap menit
  useEffect(() => {
    const updateSun = () => {
      const s = subsolarPoint();
      (material.uniforms.sunPosition!.value as THREE.Vector2).set(s.lng, s.lat);
    };
    updateSun();
    const id = setInterval(updateSun, 60_000);
    return () => clearInterval(id);
  }, [material]);

  // Tampilan bumi mengikuti tema: malam → semua lampu kota menyala, siang → terang, pagi/senja → garis matahari asli
  useEffect(() => {
    const look = theme.phase === 'night' ? 1 : theme.phase === 'day' ? 0 : 2;
    material.uniforms.lookMode!.value = look;
  }, [theme.phase, material]);

  const controls = useCallback(() => globeRef.current?.controls() as unknown as Controls | undefined, []);

  // Penanda kota berupa elemen HTML: selalu tajam di layar retina
  const markerEls = useRef(new Map<string, HTMLDivElement>());
  const flyRef = useRef<(c: City) => void>(() => {});
  const updateMarkers = useCallback((pov: { lat: number; lng: number; altitude: number }) => {
    // Sudut cakrawala yang terlihat dari ketinggian kamera
    const horizon = (Math.acos(1 / (1 + pov.altitude)) * 180) / Math.PI - 3;
    for (const c of citiesRef.current) {
      const el = markerEls.current.get(c.key);
      if (!el) continue;
      const dist = haversineKm(pov, c) / 111.195; // km → derajat
      const visible = dist < horizon;
      el.style.opacity = visible ? '1' : '0';
      el.style.pointerEvents = visible ? 'auto' : 'none';
    }
  }, []);

  const makeMarker = useCallback((d: object) => {
    const c = d as City;
    let el = markerEls.current.get(c.key);
    if (!el) {
      el = document.createElement('div');
      markerEls.current.set(c.key, el);
    }
    el.className = `olw-marker olw-marker--${c.status}`;
    el.innerHTML = `<span class="olw-marker__dot"></span><span class="olw-marker__label"></span>`;
    (el.querySelector('.olw-marker__label') as HTMLSpanElement).textContent = c.name;
    el.onclick = (e) => {
      e.stopPropagation();
      flyRef.current(c);
    };
    return el;
  }, []);

  // ── masuk ke peta 2D ──
  const flyIntoCity = useCallback(
    (city: City) => {
      const g = globeRef.current;
      if (!g || modeRef.current !== 'globe') return;
      stopJourney();
      busyRef.current = true;
      const c = controls();
      if (c) c.autoRotate = false;
      g.pointOfView({ lat: city.lat, lng: city.lng, altitude: 0.25 }, 1000);
      setTimeout(() => {
        enterMap({ cityKey: city.key, center: [city.lat, city.lng], bounds: city.bounds });
        busyRef.current = false;
      }, 950);
    },
    [controls, enterMap, stopJourney],
  );
  flyRef.current = flyIntoCity;

  const onZoom = useCallback(
    ({ lat, lng, altitude }: { lat: number; lng: number; altitude: number }) => {
      (material.uniforms.globeRotation!.value as THREE.Vector2).set(lng, lat);
      updateMarkers({ lat, lng, altitude });
      if (busyRef.current || modeRef.current !== 'globe' || altitude > ENTER_MAP_ALTITUDE) return;

      busyRef.current = true;
      const city = nearestCity(lat, lng, citiesRef.current, CITY_SNAP_KM);
      if (city) enterMap({ cityKey: city.key, center: [city.lat, city.lng], bounds: city.bounds });
      else enterMap({ center: [lat, lng], zoom: 11 });
      setTimeout(() => (busyRef.current = false), 800);
    },
    [enterMap, material, updateMarkers],
  );

  const onGlobeReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    // Batasi pixel ratio agar ringan di iPhone (layar 3x)
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const c = controls();
    if (c) {
      c.autoRotate = true;
      c.autoRotateSpeed = 0.35;
      c.enableDamping = true;
      // Pengguna mulai menggeser globe → hentikan Play Journey
      c.addEventListener('start', () => {
        if (useWorld.getState().journey.playing) useWorld.getState().stopJourney();
      });
    }

    const last = journey[journey.length - 1];
    const pov = last ? { lat: last.lat, lng: last.lng, altitude: 2.2 } : DEFAULT_POV;
    g.pointOfView(pov, 0);
    (material.uniforms.globeRotation!.value as THREE.Vector2).set(pov.lng, pov.lat);
    updateMarkers(pov);
  }, [controls, journey, material, updateMarkers]);

  // Kota baru ditambah → hitung ulang visibilitas penanda
  useEffect(() => {
    const g = globeRef.current;
    if (g) requestAnimationFrame(() => updateMarkers(g.pointOfView()));
  }, [cities, updateMarkers]);

  // ── Back to Globe: animasi "terbang keluar" dari posisi peta terakhir ──
  const prevMode = useRef(mode);
  useEffect(() => {
    const g = globeRef.current;
    const prev = prevMode.current;
    prevMode.current = mode;
    if (!g) return;

    if (mode === 'map') {
      const t = setTimeout(() => g.pauseAnimation(), 750);
      return () => clearTimeout(t);
    }

    if (prev === 'map' && mode === 'globe') {
      g.resumeAnimation();
      busyRef.current = true;
      const v = useWorld.getState().mapView;
      const lat = v?.lat ?? DEFAULT_POV.lat;
      const lng = v?.lng ?? DEFAULT_POV.lng;
      g.pointOfView({ lat, lng, altitude: 0.45 }, 0);
      g.pointOfView({ lat, lng, altitude: 2.2 }, 1600);
      const t = setTimeout(() => {
        busyRef.current = false;
        const c = controls();
        if (c) c.autoRotate = true;
      }, 1700);
      return () => clearTimeout(t);
    }
  }, [mode, controls]);

  // ── Play Journey (lihat journeyEngine.ts) ──
  const [burst, setBurst] = useState<City | null>(null);
  useEffect(() => {
    if (!journeyState.playing) return;
    const g = globeRef.current;
    if (!g || journey.length === 0) {
      stopJourney();
      return;
    }
    const c = controls();
    if (c) c.autoRotate = false;
    busyRef.current = true;

    let burstTimer: ReturnType<typeof setTimeout> | undefined;
    const run = runJourney(g, journey, theme.accent, {
      onPov: (pov) => {
        (material.uniforms.globeRotation!.value as THREE.Vector2).set(pov.lng, pov.lat);
        updateMarkers(pov);
      },
      onArrive: (city) => {
        setBurst(city);
        clearTimeout(burstTimer);
        burstTimer = setTimeout(() => setBurst(null), 2200);
      },
    });

    return () => {
      run.cancel();
      clearTimeout(burstTimer);
      setBurst(null);
      busyRef.current = false;
      const cc = controls();
      if (cc) cc.autoRotate = true;
    };
    // theme.accent sengaja tidak jadi dependency: ganti tema tidak boleh mengulang journey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyState.playing, journey, controls, stopJourney, material, updateMarkers]);

  // ── data visual ──
  // Gelombang cahaya hanya saat tiba di kota (Play Journey)
  const rings = useMemo(() => (burst ? [{ lat: burst.lat, lng: burst.lng }] : []), [burst]);

  if (size.w === 0) return null;

  return (
    <Globe
      ref={globeRef}
      width={size.w}
      height={size.h}
      backgroundColor="rgba(0,0,0,0)"
      rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      globeMaterial={material}
      showAtmosphere
      atmosphereColor={theme.atmosphere}
      atmosphereAltitude={0.2}
      onGlobeReady={onGlobeReady}
      onZoom={onZoom}
      // Penanda kota (HTML, tajam di retina)
      htmlElementsData={cities}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.004}
      htmlElement={makeMarker}
      htmlTransitionDuration={0}
      // Gelombang cahaya saat tiba di kota
      ringsData={rings}
      ringLat="lat"
      ringLng="lng"
      ringColor={() => (t: number) => `rgba(255,250,242,${Math.max(0, 1 - t)})`}
      ringMaxRadius={4}
      ringPropagationSpeed={3}
      ringRepeatPeriod={450}
      ringAltitude={0.003}
    />
  );
}
