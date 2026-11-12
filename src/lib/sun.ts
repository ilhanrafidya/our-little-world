/**
 * Titik subsolar (tempat matahari tepat di atas kepala) untuk waktu tertentu.
 * Aproksimasi astronomi sederhana (deklinasi + equation of time), akurat ±1°,
 * cukup untuk menggambar garis siang/malam di globe.
 */
export function subsolarPoint(date: Date = new Date()): { lat: number; lng: number } {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - startOfYear) / 864e5;

  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));

  const B = (2 * Math.PI * (dayOfYear - 81)) / 364;
  const equationOfTimeMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lng = (12 - utcHours - equationOfTimeMin / 60) * 15;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;

  return { lat: declination, lng };
}
