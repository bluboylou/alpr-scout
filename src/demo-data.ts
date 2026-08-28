import { parseOverpassResponse, type NearbyCamera } from './deflock-data'
import type { Coordinate } from './geo'

export const DEMO_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 8,
} as const

export function createDemoCameras(origin: Coordinate = DEMO_LOCATION): NearbyCamera[] {
  const latitude = origin.latitude
  const longitude = origin.longitude

  return parseOverpassResponse(
    {
      elements: [
        {
          type: 'node',
          id: 9_000_000_001,
          lat: latitude + 0.0008,
          lon: longitude + 0.001,
          tags: {
            'camera:mount': 'pole',
            'camera:type': 'fixed',
            direction: '215',
            man_made: 'surveillance',
            manufacturer: 'Flock Safety',
            operator: 'City Police Department',
            surveillance: 'public',
            'surveillance:type': 'ALPR',
            'surveillance:zone': 'traffic',
          },
        },
        {
          type: 'node',
          id: 9_000_000_002,
          lat: latitude - 0.0005,
          lon: longitude - 0.003,
          tags: {
            'camera:mount': 'traffic_signal',
            'camera:type': 'fixed',
            direction: '90;270',
            man_made: 'surveillance',
            manufacturer: 'Motorola Solutions',
            operator: 'County Sheriff',
            surveillance: 'public',
            'surveillance:type': 'ALPR',
            'surveillance:zone': 'traffic',
          },
        },
        {
          type: 'node',
          id: 9_000_000_003,
          lat: latitude - 0.0068,
          lon: longitude + 0.0004,
          tags: {
            'camera:mount': 'gantry',
            'camera:type': 'fixed',
            direction: '350',
            man_made: 'surveillance',
            manufacturer: 'Genetec',
            operator: 'Department of Transportation',
            surveillance: 'public',
            'surveillance:type': 'ALPR',
            'surveillance:zone': 'traffic',
          },
        },
        {
          type: 'node',
          id: 9_000_000_004,
          lat: latitude + 0.0096,
          lon: longitude - 0.0106,
          tags: {
            'camera:mount': 'street_lamp',
            'camera:type': 'fixed',
            direction: '135',
            man_made: 'surveillance',
            manufacturer: 'Leonardo',
            operator: 'Regional Transit Authority',
            surveillance: 'public',
            'surveillance:type': 'ALPR',
            'surveillance:zone': 'traffic',
          },
        },
      ],
    },
    origin,
  ).map((camera) => ({ ...camera, isDemo: true }))
}
