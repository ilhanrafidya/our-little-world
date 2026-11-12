# Our Little World 🌍💗

Peta kenangan privat berdua: Globe 3D ⇄ Peta 2D, Polaroid memories, di-deploy gratis di Vercel.

**Progres:** ✅ Tahap 1 (blueprint) · ✅ Tahap 2 (backend & auth) · ✅ Tahap 3 (hybrid map) · ✅ Tahap 4 (Polaroid, Add Spot, polish)

---

## Setup (sekali saja)

### 1. Install & push ke GitHub
```bash
npm install
git init && git add . && git commit -m "Tahap 2: backend & auth"
# buat repo PRIVAT di GitHub, lalu:
git remote add origin https://github.com/<username>/our-little-world.git
git push -u origin main
```

### 2. Buat project di Vercel
1. vercel.com → **Add New → Project** → import repo `our-little-world`.
2. Deploy pertama boleh gagal/kosong dulu — env belum lengkap.

### 3. Sambungkan Neon Postgres
1. Di project Vercel → tab **Storage → Create Database → Neon (Postgres)** → pilih region **Singapore** (terdekat ke Indonesia) → Connect ke project.
   `DATABASE_URL` & teman-temannya otomatis masuk ke Environment Variables.
2. Klik **Open in Neon** → **SQL Editor** → copy-paste isi `db/schema.sql` → **Run**.
3. (Opsional) jalankan `db/seed.sql` untuk data contoh.

### 4. Sambungkan Vercel Blob
Tab **Storage → Create → Blob** → Connect ke project. `BLOB_READ_WRITE_TOKEN` otomatis masuk.

### 5. Tambah env passcode
Di **Settings → Environment Variables**, tambahkan:

| Key | Value |
|---|---|
| `APP_PASSCODE` | kode rahasia kalian (min. 4 karakter) |
| `SESSION_SECRET` | hasil `npm run gen:secret` (min. 32 karakter) |
| `SESSION_MAX_AGE_DAYS` | `30` |

Lalu **Deployments → Redeploy**.

### 6. Jalankan lokal
```bash
npm i -g vercel        # sekali saja
vercel link            # hubungkan folder ke project Vercel
vercel env pull .env.local
npm run dev
```
Buka http://localhost:3000 → otomatis diarahkan ke `/unlock`.

> **Tes dari HP di Wi-Fi yang sama:** `npm run dev -- -H 0.0.0.0`, lalu buka `http://IP-LAPTOP:3000` di Safari/Chrome HP.
> (Geolocation baru jalan di HTTPS — untuk itu tes di URL Vercel.)

---

## Ceklis tes Tahap 2

- [ ] Buka `/` tanpa login → diarahkan ke `/unlock`
- [ ] Kode salah → kartu bergetar + pesan error; 5× salah → dikunci sementara
- [ ] Kode benar → masuk, halaman menampilkan "✅ Terhubung — N spot…"
- [ ] Tombol 🔒 Kunci → kembali ke `/unlock`
- [ ] Ganti `APP_PASSCODE` di Vercel + redeploy → semua device harus unlock ulang

Tes API dari **browser yang sudah unlock** (DevTools → Console):
```js
// CREATE
const r = await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Tes Kafe', city: 'Depok', lat: -6.36, lng: 106.82, status: 'visited',
    memoryDate: '2025-01-01', story: 'tes', spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=x' }) });
const { memory } = await r.json(); memory;

// LIST
(await (await fetch('/api/memories')).json()).memories.length;

// EDIT
await (await fetch(`/api/memories/${memory.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'wishlist', memoryDate: null }) })).json();

// DELETE
await (await fetch(`/api/memories/${memory.id}`, { method: 'DELETE' })).json();
```

---

## Ringkasan API

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/unlock` | `{ passcode }` → set cookie sesi HttpOnly |
| POST | `/api/auth/lock` | hapus cookie (logout) |
| GET | `/api/memories` | semua spot, urut kronologis |
| POST | `/api/memories` | buat spot (validasi Zod) |
| GET | `/api/memories/:id` | satu spot |
| PATCH | `/api/memories/:id` | edit sebagian; `null` = kosongkan; foto lama otomatis dihapus dari Blob |
| DELETE | `/api/memories/:id` | hapus spot + fotonya |
| POST | `/api/upload` | token client-upload Vercel Blob (dipakai `upload()` di Tahap 4) |

Semua endpoint (kecuali unlock/lock) menolak dengan `401` jika belum unlock.

---

## Pakai di HP seperti aplikasi

- **iPhone (Safari):** buka situsnya → tombol Share → **Add to Home Screen**.
- **Android (Chrome):** menu ⋮ → **Add to Home screen / Install app**.

## Fitur utama

- Globe 3D (tema mengikuti jam: pagi/siang/senja/malam) + flight arcs + ▶ Play Journey
- Tap kota / zoom → peta 2D; pin 💗 Visited & ⭐ Wishlist
- Tap pin → kartu Polaroid yang bisa dibalik (foto ⇄ cerita + lagu Spotify), Edit & Hapus
- Tombol **+** → tambah kenangan: foto (otomatis dikompres), lokasi GPS / pilih di peta, kota otomatis terisi
