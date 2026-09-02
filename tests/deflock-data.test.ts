import { describe, expect, it } from 'vitest'
import {
  fetchNearbyCameras,
  formatCameraFacing,
  parseCameraDirections,
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

  it('sends a bounded nearby ALPR query that includes result geometry', async () => {
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
    const requestData = new URLSearchParams(
      String(capturedRequest?.options?.body),
    ).get('data')
    expect(requestData).toContain('surveillance:type')
    expect(requestData).toContain('ALPR')
    expect(requestData).toContain('out tags center;')
  })

  it('broadens discovery to ANPR/LPR synonyms and major manufacturers', async () => {
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

    const requestData = new URLSearchParams(
      String(capturedRequest?.options?.body),
    ).get('data')

    // Synonym branch matches ANPR/LPR/license-plate type tags.
    expect(requestData).toContain('~"ALPR|ANPR|LPR|license_plate",i')
    // Manufacturer branch matches brand-tagged cameras without a type tag.
    expect(requestData).toContain('~"Flock|Motorola|Vigilant|Genetec|Leonardo|Neology|Rekor",i')
    // Both branches are unioned with a parenthesized Overpass query.
    expect(requestData).toContain('(')
    expect(requestData).toContain(');')
  })
})

describe('camera direction parsing', () => {
  it('returns an empty list when no direction tag is present', () => {
    expect(parseCameraDirections({})).toEqual([])
  })

  it('parses a single numeric angle and normalizes it', () => {
    expect(parseCameraDirections({ direction: '215' })).toEqual([215])
    expect(parseCameraDirections({ direction: '-45' })).toEqual([315])
  })

  it('parses multi-value directions split on ; or ,', () => {
    expect(parseCameraDirections({ direction: '90;270' })).toEqual([90, 270])
    expect(parseCameraDirections({ 'camera:direction': 'N;S' })).toEqual([0, 180])
  })

  it('ignores unparseable tokens but keeps valid ones', () => {
    expect(parseCameraDirections({ direction: '45; banana ; 180' })).toEqual([45, 180])
  })

  it('formats facing as degrees + cardinal, joining multiple values', () => {
    expect(formatCameraFacing({ direction: '215' })).toBe('215° SW')
    expect(formatCameraFacing({ direction: '90;270' })).toBe('90° E / 270° W')
    expect(formatCameraFacing({ direction: 'N;S' })).toBe('0° N / 180° S')
    expect(formatCameraFacing({})).toBe('Unknown')
  })
})
