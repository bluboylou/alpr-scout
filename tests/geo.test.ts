import { describe, expect, it } from 'vitest'
import {
  cardinalDirection,
  distanceMeters,
  formatDistance,
  initialBearingDegrees,
  normalizeDegrees,
} from '../src/geo'

describe('geo helpers', () => {
  it('normalizes angles', () => {
    expect(normalizeDegrees(-15)).toBe(345)
    expect(normalizeDegrees(375)).toBe(15)
  })

  it('calculates distance and bearing', () => {
    const origin = { latitude: 0, longitude: 0 }
    const east = { latitude: 0, longitude: 1 }

    expect(distanceMeters(origin, east)).toBeCloseTo(111_195, -1)
    expect(initialBearingDegrees(origin, east)).toBeCloseTo(90, 5)
  })

  it('formats glanceable directions and distances', () => {
    expect(cardinalDirection(359)).toBe('N')
    expect(cardinalDirection(91)).toBe('E')
    expect(formatDistance(425)).toBe('425 m')
    expect(formatDistance(1_250)).toBe('1.3 km')
  })
})

