export interface Coordinate {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_METERS = 6_371_000

const toRadians = (degrees: number): number => degrees * (Math.PI / 180)
const toDegrees = (radians: number): number => radians * (180 / Math.PI)

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function initialBearingDegrees(from: Coordinate, to: Coordinate): number {
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)

  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude)
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta)

  return normalizeDegrees(toDegrees(Math.atan2(y, x)))
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function cardinalDirection(degrees: number): string {
  const index = Math.round(normalizeDegrees(degrees) / 45) % CARDINALS.length
  return CARDINALS[index] ?? 'N'
}

export function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.max(0, Math.round(meters))} m`
  if (meters < 10_000) return `${(meters / 1_000).toFixed(1)} km`
  return `${Math.round(meters / 1_000)} km`
}

