import { describe, expect, it } from 'vitest'
import {
  fetchNearbyCameras,
  parseOverpassResponse,
} from '../src/deflock-data'

const origin = { latitude: 37.7749, longitude: -122.4194 }

describe('DeFlock-compatible OSM data', () => {
  it('validates, deduplicates, and sorts Overpass nodes', () => {
    const result = parseOverpassResponse(
      {
        elements: [
          {
            type: 'node',
            id: 2,
            lat: 37.7849,
            lon: -122.4194,
            tags: { manufacturer: 'Flock Safety', ignored: 42 },
          },
          {
            type: 'node',
            id: 1,
            lat: 37.775,
            lon: -122.4194,
            tags: { manufacturer: 'Genetec' },
          },
          { type: 'node', id: 1, lat: 0, lon: 0 },
          { type: 'way', id: 3, lat: 37.775, lon: -122.4194 },
          { type: 'node', id: 'bad', lat: 37.775, lon: -122.4194 },
        ],
      },
      origin,
    )

    expect(result).toHaveLength(2)
    expect(result.map((camera) => camera.id)).toEqual([1, 2])
    expect(result[1]?.tags).toEqual({ manufacturer: 'Flock Safety' })
  })

  it('sends a bounded nearby ALPR query', async () => {
    let capturedRequest:
      | { input: RequestInfo | URL; options?: RequestInit }
      | undefined
    const mockFetch: typeof fetch = async (input, options) => {
      capturedRequest = { input, options }
      return new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await fetchNearbyCameras(origin, 5_000, mockFetch)

    expect(String(capturedRequest?.input)).toContain('overpass-api.de')
    expect(capturedRequest?.options?.method).toBe('POST')
    expect(String(capturedRequest?.options?.body)).toContain('surveillance%3Atype')
    expect(String(capturedRequest?.options?.body)).toContain('ALPR')
  })
})
