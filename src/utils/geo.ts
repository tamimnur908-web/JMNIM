/**
 * Geolocation and Haversine distance calculator for Madrasa Teacher Attendance
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the great-circle distance between two points in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const lat1Rad = toRad(coord1.lat);
  const lat2Rad = toRad(coord2.lat);
  const deltaLat = toRad(coord2.lat - coord1.lat);
  const deltaLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // returns distance in meters rounded
}

/**
 * Validates if the given coordinates fall within the allowed radius
 */
export function isWithinAllowedRadius(
  currentCoord: { lat: number; lng: number },
  madrasaCoord: { lat: number; lng: number },
  allowedRadiusMeters: number
): { isAllowed: boolean; distanceMeters: number } {
  const distance = calculateHaversineDistance(currentCoord, madrasaCoord);
  return {
    isAllowed: distance <= allowedRadiusMeters,
    distanceMeters: distance,
  };
}
