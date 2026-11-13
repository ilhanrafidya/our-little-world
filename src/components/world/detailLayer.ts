import * as THREE from 'three';
import type { GlobeMethods } from 'react-globe.gl';

/**
 * Lapisan detail satelit: saat kamera turun dekat, potongan citra satelit
 * dimuat untuk area yang sedang dilihat lalu "dibentangkan" di atas globe.
 * Warnanya melewati rumus siang/malam yang sama dengan globe (uniform dipakai bersama),
 * jadi di mode malam citra satelit ikut gelap + lampu kota tetap menyala.
 */

const TILE = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const SHOW_BELOW = 0.62; // mulai terlihat di bawah ketinggian ini
const FULL_BELOW = 0.36; // terlihat penuh di bawah ketinggian ini
const PATCH_ALT = 0.00025;
const GRID = 48;
const MAX_TILES_SIDE = 7;

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const tileX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;
const tileY = (lat: number, z: number) => {
  const r = lat * D2R;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

const vertexShader = /* glsl */ `
  attribute vec2 worldUv;
  attribute vec2 edge;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec2 vWorldUv;
  varying vec2 vEdge;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vWorldUv = worldUv;
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  #define PI 3.141592653589793
  uniform sampler2D satTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunPosition;
  uniform vec2 globeRotation;
  uniform float lookMode;
  uniform float opacity;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec2 vWorldUv;
  varying vec2 vEdge;

  float toRad(in float a) { return a * PI / 180.0; }
  vec3 Polar2Cartesian(in vec2 c) {
    float theta = toRad(90.0 - c.x);
    float phi = toRad(90.0 - c.y);
    return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
  }

  void main() {
    float invLon = toRad(globeRotation.x);
    float invLat = -toRad(globeRotation.y);
    mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
    mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
    vec3 sunDir = rotX * rotY * Polar2Cartesian(sunPosition);
    float intensity = dot(normalize(vNormal), normalize(sunDir));

    // citra satelit sedikit diredam agar senada dengan tekstur globe
    vec3 sat = texture2D(satTexture, vUv).rgb;
    float g = dot(sat, vec3(0.299, 0.587, 0.114));
    vec3 dayColor = mix(vec3(g), sat, 0.88) * 0.96;
    vec4 lights = texture2D(nightTexture, vWorldUv);

    vec3 moonlit = dayColor * vec3(0.5, 0.6, 0.92) + vec3(0.02, 0.03, 0.07);
    float lum = max(max(lights.r, lights.g), lights.b);
    float glow = smoothstep(0.04, 0.45, lum);
    vec3 city = lights.rgb * 1.6 + vec3(1.0, 0.8, 0.45) * glow * 1.1;
    vec3 nightColor = min(moonlit * (1.0 - glow * 0.45) + city, vec3(1.0));

    float blend;
    if (lookMode < 0.5) blend = 1.0;
    else if (lookMode < 1.5) blend = 0.0;
    else blend = smoothstep(-0.2, 0.2, intensity);

    // tepi potongan memudar halus → tidak terlihat seperti kotak tempelan
    float e = min(min(vEdge.x, 1.0 - vEdge.x), min(vEdge.y, 1.0 - vEdge.y));
    float a = opacity * smoothstep(0.0, 0.12, e);
    gl_FragColor = vec4(mix(nightColor, dayColor, blend), a);
  }
`;

type Uniforms = Record<string, THREE.IUniform>;
type Pov = { lat: number; lng: number; altitude: number };

interface Patch {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  tex: THREE.Texture;
  lat: number;
  lng: number;
  alt: number;
  spanKm: number;
  fade: number; // 0..1 (muncul setelah gambar siap)
  dying: boolean;
}

export class DetailLayer {
  private g: GlobeMethods;
  private shared: Uniforms;
  private patches: Patch[] = [];
  private pov: Pov | null = null;
  private building = false;
  private lastCheck = 0;
  private raf = 0;
  private disposed = false;
  private visible = false;
  private onVisible: (v: boolean) => void;

  constructor(g: GlobeMethods, shared: Uniforms, onVisible: (v: boolean) => void) {
    this.g = g;
    this.shared = shared;
    this.onVisible = onVisible;
    let last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      this.tick(now, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** dipanggil setiap kamera berubah */
  update(pov: Pov) {
    this.pov = pov;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const p of this.patches) this.destroy(p);
    this.patches = [];
  }

  private tick(now: number, dt: number) {
    const pov = this.pov;
    const altOpacity = pov ? 1 - smooth(FULL_BELOW, SHOW_BELOW, pov.altitude) : 0;

    // perlu potongan baru? (diperiksa ±4x per detik)
    if (pov && pov.altitude < SHOW_BELOW && !this.building && now - this.lastCheck > 250) {
      this.lastCheck = now;
      const cur = this.patches.find((p) => !p.dying);
      const needs =
        !cur ||
        distKm(cur, pov) > cur.spanKm * 0.2 ||
        pov.altitude < cur.alt * 0.55 ||
        pov.altitude > cur.alt * 1.9;
      if (needs) void this.build(pov);
    }

    let anyVisible = false;
    for (const p of [...this.patches]) {
      p.fade = clamp(p.fade + (p.dying ? -dt / 0.5 : dt / 0.45), 0, 1);
      p.mat.uniforms.opacity!.value = p.fade * altOpacity;
      p.mesh.visible = p.fade * altOpacity > 0.002;
      if (p.mesh.visible && !p.dying) anyVisible = true;
      if (p.dying && p.fade <= 0) this.destroy(p);
    }
    const vis = anyVisible && altOpacity > 0.3;
    if (vis !== this.visible) {
      this.visible = vis;
      this.onVisible(vis);
    }
  }

  private destroy(p: Patch) {
    this.g.scene().remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mat.dispose();
    p.tex.dispose();
    this.patches = this.patches.filter((x) => x !== p);
  }

  private async build(pov: Pov) {
    this.building = true;
    try {
      const lat = clamp(pov.lat, -80, 80);
      const lng = pov.lng;
      const spanKm = clamp(pov.altitude * 6371 * 2.6, 60, 3000);
      const halfLat = spanKm / 2 / 111.2;
      const halfLng = halfLat / Math.max(0.2, Math.cos(lat * D2R));
      const lat0 = clamp(lat - halfLat, -84, 84);
      const lat1 = clamp(lat + halfLat, -84, 84);
      const lng0 = lng - halfLng;
      const lng1 = lng + halfLng;

      // level zoom terbesar yang masih muat MAX_TILES_SIDE potongan
      let z = 3;
      for (let k = 17; k >= 3; k--) {
        const nx = Math.floor(tileX(lng1, k)) - Math.floor(tileX(lng0, k)) + 1;
        const ny = Math.floor(tileY(lat0, k)) - Math.floor(tileY(lat1, k)) + 1;
        if (nx <= MAX_TILES_SIDE && ny <= MAX_TILES_SIDE) {
          z = k;
          break;
        }
      }
      const n = 2 ** z;
      const x0 = Math.floor(tileX(lng0, z));
      const x1 = Math.floor(tileX(lng1, z));
      const y0 = Math.floor(tileY(lat1, z));
      const y1 = Math.floor(tileY(lat0, z));
      const cols = x1 - x0 + 1;
      const rows = y1 - y0 + 1;

      const canvas = document.createElement('canvas');
      canvas.width = cols * 256;
      canvas.height = rows * 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const jobs: Promise<void>[] = [];
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (ty < 0 || ty >= n) continue;
          const wx = ((tx % n) + n) % n;
          jobs.push(
            loadImage(TILE(z, wx, ty)).then((img) => {
              if (img) ctx.drawImage(img, (tx - x0) * 256, (ty - y0) * 256);
            }),
          );
        }
      }
      await Promise.all(jobs);
      if (this.disposed) return;

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = Math.min(8, (this.g.renderer() as THREE.WebGLRenderer).capabilities.getMaxAnisotropy());
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;

      // geometri: grid lat/lng, UV mengikuti proyeksi Mercator potongan
      const pos: number[] = [];
      const nor: number[] = [];
      const uv: number[] = [];
      const wuv: number[] = [];
      const edge: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= GRID; j++) {
        const la = lat0 + ((lat1 - lat0) * j) / GRID;
        for (let i = 0; i <= GRID; i++) {
          const lo = lng0 + ((lng1 - lng0) * i) / GRID;
          const c = this.g.getCoords(la, lo, PATCH_ALT);
          const len = Math.hypot(c.x, c.y, c.z) || 1;
          pos.push(c.x, c.y, c.z);
          nor.push(c.x / len, c.y / len, c.z / len);
          uv.push((tileX(lo, z) - x0) / cols, 1 - (tileY(la, z) - y0) / rows);
          const wl = ((((lo + 180) % 360) + 360) % 360) / 360;
          wuv.push(wl, (la + 90) / 180);
          edge.push(i / GRID, j / GRID);
        }
      }
      for (let j = 0; j < GRID; j++) {
        for (let i = 0; i < GRID; i++) {
          const a = j * (GRID + 1) + i;
          const b = a + 1;
          const c = a + GRID + 1;
          const d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('worldUv', new THREE.Float32BufferAttribute(wuv, 2));
      geo.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 2));
      geo.setIndex(idx);

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          satTexture: { value: tex },
          nightTexture: this.shared.nightTexture!,
          sunPosition: this.shared.sunPosition!,
          globeRotation: this.shared.globeRotation!,
          lookMode: this.shared.lookMode!,
          opacity: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      this.g.scene().add(mesh);

      for (const p of this.patches) p.dying = true;
      this.patches.push({ mesh, mat, tex, lat, lng, alt: pov.altitude, spanKm, fade: 0, dying: false });
    } finally {
      this.building = false;
    }
  }
}

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * D2R;
  const dLng = (b.lng - a.lng) * D2R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const t = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = url;
  });
}
