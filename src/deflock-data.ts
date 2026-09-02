import {
  cardinalDirection,
  distanceMeters,
  initialBearingDegrees,
  normalizeDegrees,
  type Coordinate,
} from './geo'

export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
export const DEFAULT_RADIUS_METERS = 5_000

export interface NearbyCamera extends Coordinate {
  id: number
  distanceMeters: number
  bearingDegrees: number
  tags: Record<string, string>
  isDemo?: boolean
}

interface OverpassElement {
  type?: unknown
  id?: unknown
  lat?: unknown
  lon?: unknown
  tags?: unknown
}

interface OverpassPayload {
  elements?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTags(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value.trim()]),
  )
}

export function parseOverpassResponse(
  payload: unknown,
  origin: Coordinate,
  limit = 50,
): NearbyCamera[] {
  if (!isRecord(payload)) return []

  const elements = (payload as OverpassPayload).elements
  if (!Array.isArray(elements)) return []

  const cameras: NearbyCamera[] = []
  const seen = new Set<number>()

  for (const rawElement of elements as OverpassElement[]) {
    const id = rawElement.id
    const latitude = rawElement.lat
    const longitude = rawElement.lon

    if (
      rawElement.type !== 'node' ||
      typeof id !== 'number' ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      seen.has(id)
    ) {
      continue
    }

    seen.add(id)
    const coordinate = { latitude, longitude }
    cameras.push({
      id,
      ...coordinate,
      tags: parseTags(rawElement.tags),
      distanceMeters: distanceMeters(origin, coordinate),
      bearingDegrees: initialBearingDegrees(origin, coordinate),
    })
  }

  return cameras
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, Math.max(0, limit))
}

function buildNearbyQuery(origin: Coordinate, radiusMeters: number): string {
  const radius = Math.min(25_000, Math.max(100, Math.round(radiusMeters)))
  const latitude = origin.latitude.toFixed(6)
  const longitude = origin.longitude.toFixed(6)

  // Broaden discovery beyond the strict `surveillance:type=ALPR` tag:
  //  - also match ALPR synonyms (ANPR/LPR/license-plate recognition)
  //  - also match major ALPR manufacturers even when mappers omit the type tag
  // Results are de-duplicated by node id downstream. `center` keeps node
  // geometry so matched cameras can be placed on the map and linked.
  return `[out:json][timeout:20];(
  node(around:${radius},${latitude},${longitude})["man_made"="surveillance"]["surveillance:type"~"ALPR|ANPR|LPR|license_plate",i];
  node(around:${radius},${latitude},${longitude})["man_made"="surveillance"]["manufacturer"~"Flock|Motorola|Vigilant|Genetec|Leonardo|Neology|Rekor",i];
);out tags center;`
}

export async function fetchNearbyCameras(
  origin: Coordinate,
  radiusMeters = DEFAULT_RADIUS_METERS,
  fetchImplementation: typeof fetch = fetch,
): Promise<NearbyCamera[]> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 22_000)

  try {
    const body = new URLSearchParams({ data: buildNearbyQuery(origin, radiusMeters) })
    const response = await fetchImplementation(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Camera lookup failed with HTTP ${response.status}`)
    }

    return parseOverpassResponse(await response.json(), origin)
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export function cameraDisplayName(camera: NearbyCamera): string {
  return (
    camera.tags.manufacturer ||
    camera.tags.brand ||
    camera.tags.operator ||
    'Unidentified ALPR'
  )
}

const DIRECTION_CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function parseCameraDirections(tags: Record<string, string>): number[] {
  const raw = tags.direction ?? tags['camera:direction']
  if (!raw) return []

  return raw
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(parseDirectionToken)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)
}

function parseDirectionToken(token: string): number | null {
  const numeric = Number(token)
  if (Number.isFinite(numeric)) return normalizeDegrees(numeric)

  const index = DIRECTION_CARDINALS.indexOf(
    token.toUpperCase() as (typeof DIRECTION_CARDINALS)[number],
  )
  return index >= 0 ? index * 45 : null
}

export function formatCameraFacing(tags: Record<string, string>): string {
  const directions = parseCameraDirections(tags)
  if (directions.length === 0) return 'Unknown'
  return directions
    .map((degrees) => `${Math.round(degrees)}° ${cardinalDirection(degrees)}`)
    .join(' / ')
}
