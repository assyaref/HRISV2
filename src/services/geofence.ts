/**
 * Geofencing Service
 * 
 * Validasi lokasi absensi berdasarkan koordinat kantor.
 * Coordinates are configurable via GEOFENCE_CONFIG.
 */

// Default coordinates (Pekanbaru) - override via GEOFENCE_CONFIG or settings
const DEFAULT_OFFICE_LAT = -1.282646;
const DEFAULT_OFFICE_LNG = 101.181111;
const DEFAULT_OFFICE_RADIUS_METERS = 200;

let _officeLat = DEFAULT_OFFICE_LAT;
let _officeLng = DEFAULT_OFFICE_LNG;
let _officeRadius = DEFAULT_OFFICE_RADIUS_METERS;

/**
 * Update geofence configuration from settings
 */
export function configureGeofence(lat: number, lng: number, radiusMeters: number): void {
  _officeLat = lat;
  _officeLng = lng;
  _officeRadius = radiusMeters;
}

/**
 * Hitung jarak antara dua koordinat menggunakan Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius bumi dalam meter
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GeofenceResult {
  valid: boolean;
  distance: number;
  message: string;
}

/**
 * Validasi apakah lokasi user berada dalam radius kantor
 */
export function validateGeofence(lat: number, lng: number, radiusMeters?: number): GeofenceResult {
  const radius = radiusMeters ?? _officeRadius;
  const distance = haversineDistance(lat, lng, _officeLat, _officeLng);
  const valid = distance <= radius;

  if (valid) {
    return {
      valid: true,
      distance: Math.round(distance),
      message: `📍 Anda berada dalam area kantor (${Math.round(distance)}m dari kantor)`,
    };
  }

  return {
    valid: false,
    distance: Math.round(distance),
    message: `📍 Anda berada ${Math.round(distance)}m dari kantor. Maksimal ${radius}m untuk absensi.`,
  };
}

/**
 * Dapatkan lokasi user via GPS
 */
export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Izin lokasi ditolak. Aktifkan GPS untuk absensi.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Lokasi tidak tersedia. Coba di luar ruangan.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Waktu permintaan lokasi habis. Coba lagi.'));
            break;
          default:
            reject(new Error('Gagal mendapatkan lokasi.'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/**
 * Dapatkan alamat dari koordinat (reverse geocoding)
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=id`,
      { headers: { 'User-Agent': 'HRIS-Lite/1.0' } }
    );
    const data = await response.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export const GEOFENCE_CONFIG = {
  get officeLat() { return _officeLat; },
  get officeLng() { return _officeLng; },
  get officeRadiusMeters() { return _officeRadius; },
  officeAddress: 'Pekanbaru, Riau',
};