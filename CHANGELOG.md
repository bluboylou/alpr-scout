# Changelog

All notable changes to ALPR Scout are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.4] - 2026-09-01

### Added
- **Broader camera discovery.** The nearby-camera Overpass query now also
  matches ALPR synonyms (`surveillance:type` `~ANPR|LPR|license_plate`,
  case-insensitive) and major ALPR manufacturers (`manufacturer`
  `~Flock|Motorola|Vigilant|Genetec|Leonardo|Neology|Rekor`), so brand-tagged
  public cameras show up even when mappers omit the `surveillance:type=ALPR`
  tag. Axis is deliberately excluded to avoid generic-CCTV noise. Results are
  still de-duplicated by node id and capped at 50.
- **Multi-direction facing readout.** The glasses "Faces:" line now parses
  semicolon/comma-separated direction tags (e.g. `90;270` or `N;S`) and shows
  each as `90° E / 270° W`. Single values show degrees + cardinal
  (e.g. `215° SW`), and missing direction shows `Unknown` instead of a blank.

### Notes
- The widened query reaches further afield than a strict `=ALPR` filter; expect
  a denser nearby list in areas with brand-tagged but untyped cameras. The 5 km
  default radius and 50-result cap still bound the display.
- On-device runtime confirmation on the G2 is still pending.

## [0.1.3] - 2026-08-29

### Fixed
- **Coordinates retained through the nearby lookup.** The camera list kept its
  position but lost lat/lon in an earlier refactor; the reported coordinates
  (used for the phone handoff/deep links) are now preserved end to end, so the
  OSM/DeFlock links point at the correct node.

## [0.1.2] - 2026-08-28

### Fixed
- **Stabilized the report flow and demo mode.** Resolved a state-machine edge
  case where cancelling a report mid-flow could leave the home screen in a
  stale state, and tightened the dev-only demo fallback so simulator cameras
  load reliably when a live Overpass lookup is unavailable.

## [0.1.1] - 2026-08-28

### Fixed
- **Report flow could appear unresponsive on the glasses.** Pressing
  "Report a camera" from the home menu called `getAppLocation()` and, when
  the Even G2 host returned no location (GPS off or location permission not
  granted) or rejected the call, silently bounced back to the home screen —
  looking like the button did nothing. The report now falls back to the last
  known location captured during the nearby-camera scan, instead of aborting.
- **Clearer failure messaging.** When there is genuinely no location
  available, the home screen now shows "Location unavailable. Enable phone
  GPS and location permission." instead of the ambiguous "Location
  unavailable; report not started."
- **No more lost cursor on error.** An error during an action now preserves
  the current home-menu selection instead of resetting to the top row.
- **Shorter location wait.** The fresh location fix timeout was reduced from
  10 s to 5 s, so a missing GPS fix no longer freezes the input as long.

### Notes
- The phone handoff (OSM/DeFlock tag set, copy button, editor links) is
  unchanged. The report uses the last known location when a fresh fix is
  unavailable; you can still adjust the pin on the phone before saving.
- On-device runtime confirmation on the G2 is still pending. A debug build
  (`report-debug.patch`) with `[ALPR-DEBUG]` console logging is available to
  confirm which `getAppLocation` branch triggers on real hardware.

## [0.1.0] - 2026-08-28

### Added
- Initial release: Even G2 companion app for finding nearby public ALPR
  cameras and preparing a DeFlock/OpenStreetMap report handoff.
- Nearby-camera browse from Overpass/DeFlock data.
- 4-step camera report (photo, maker, mount, direction) with OSM tag
  generation and phone handoff page.
