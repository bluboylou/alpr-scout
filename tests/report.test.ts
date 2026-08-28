import { describe, expect, it } from 'vitest'
import {
  CAMERA_PROFILES,
  buildOsmEditorUrl,
  buildReportTags,
  formatOsmTags,
} from '../src/report'

describe('report handoff', () => {
  it('creates the DeFlock-compatible Flock tag set', () => {
    const profile = CAMERA_PROFILES[0]
    expect(profile).toBeDefined()
    if (!profile) return

    const tags = buildReportTags(profile, 'pole', -15)

    expect(tags).toMatchObject({
      man_made: 'surveillance',
      surveillance: 'public',
      'surveillance:type': 'ALPR',
      'surveillance:zone': 'traffic',
      'camera:type': 'fixed',
      'camera:mount': 'pole',
      direction: '345',
      manufacturer: 'Flock Safety',
      'manufacturer:wikidata': 'Q108485435',
    })
    expect(formatOsmTags(tags)).toContain('surveillance:type=ALPR')
  })

  it('positions the OSM editor at the captured location', () => {
    const url = buildOsmEditorUrl({ latitude: 37.7749, longitude: -122.4194 })
    expect(url).toContain('editor=id')
    expect(url).toContain('#map=20/37.774900/-122.419400')
  })
})

