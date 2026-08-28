import { normalizeDegrees, type Coordinate } from './geo'

export const DEFLOCK_REPORT_GUIDE_URL = 'https://deflock.org/report'

export interface CameraProfile {
  id: string
  name: string
  manufacturer: string
  wikidata?: string
}

// Mirrors the submittable built-in ALPR profiles in FoggedLens/deflock-app.
export const CAMERA_PROFILES: readonly CameraProfile[] = [
  {
    id: 'flock',
    name: 'Flock',
    manufacturer: 'Flock Safety',
    wikidata: 'Q108485435',
  },
  {
    id: 'motorola',
    name: 'Motorola/Vigilant',
    manufacturer: 'Motorola Solutions',
    wikidata: 'Q634815',
  },
  {
    id: 'genetec',
    name: 'Genetec',
    manufacturer: 'Genetec',
    wikidata: 'Q30295174',
  },
  {
    id: 'leonardo',
    name: 'Leonardo/ELSAG',
    manufacturer: 'Leonardo',
    wikidata: 'Q910379',
  },
  {
    id: 'neology',
    name: 'Neology',
    manufacturer: 'Neology, Inc.',
  },
  {
    id: 'rekor',
    name: 'Rekor',
    manufacturer: 'Rekor',
  },
  {
    id: 'axis',
    name: 'Axis',
    manufacturer: 'Axis Communications',
    wikidata: 'Q2347731',
  },
] as const

export const CAMERA_MOUNTS = [
  'pole',
  'traffic_signal',
  'street_lamp',
  'gantry',
  'wall',
] as const

export interface ReportDraft {
  createdAt: string
  location: Coordinate
  accuracyMeters?: number
  profile: CameraProfile
  mount: (typeof CAMERA_MOUNTS)[number]
  direction: number
  photoName?: string
  photoMimeType?: string
  tags: Record<string, string>
}

export function buildReportTags(
  profile: CameraProfile,
  mount: (typeof CAMERA_MOUNTS)[number],
  direction: number,
): Record<string, string> {
  const tags: Record<string, string> = {
    man_made: 'surveillance',
    surveillance: 'public',
    'surveillance:type': 'ALPR',
    'surveillance:zone': 'traffic',
    'camera:type': 'fixed',
    'camera:mount': mount,
    direction: Math.round(normalizeDegrees(direction)).toString(),
    manufacturer: profile.manufacturer,
  }

  if (profile.wikidata) tags['manufacturer:wikidata'] = profile.wikidata
  return tags
}

export function formatOsmTags(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

export function buildOsmEditorUrl(location: Coordinate): string {
  const url = new URL('https://www.openstreetmap.org/edit')
  url.searchParams.set('editor', 'id')
  url.hash = `map=20/${location.latitude.toFixed(6)}/${location.longitude.toFixed(6)}`
  return url.toString()
}

export function buildOsmNodeUrl(nodeId: number): string {
  return `https://www.openstreetmap.org/node/${encodeURIComponent(nodeId)}`
}

export function buildDeflockNodeUrl(nodeId: number): string {
  return `deflockapp://node?id=${encodeURIComponent(nodeId)}`
}

