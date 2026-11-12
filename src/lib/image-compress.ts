/**
 * Kompresi foto di browser sebelum upload (hemat storage & cepat di jaringan seluler).
 * - Sisi terpanjang maks 1200px
 * - WebP jika browser bisa meng-encode; fallback JPEG (Safari lama)
 * - Rotasi EXIF iPhone ikut diterapkan
 */

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  type: 'image/webp' | 'image/jpeg';
  ext: 'webp' | 'jpg';
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Format foto tidak didukung browser ini. Coba pilih foto JPG/PNG.'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File, maxSize = 1200): Promise<CompressedImage> {
  if (!file.type.startsWith('image/') && file.type !== '') {
    throw new Error('File yang dipilih bukan foto.');
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await loadImage(file); // <img> modern sudah otomatis menerapkan rotasi EXIF
  }

  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan foto.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();

  const webp = await toBlob(canvas, 'image/webp', 0.82);
  if (webp && webp.type === 'image/webp') {
    return { blob: webp, width, height, type: 'image/webp', ext: 'webp' };
  }
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.84);
  if (!jpeg) throw new Error('Gagal memproses foto.');
  return { blob: jpeg, width, height, type: 'image/jpeg', ext: 'jpg' };
}
