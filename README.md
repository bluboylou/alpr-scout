# ALPR Scout for Even G2

ALPR Scout is a lightweight Even Hub plugin for browsing nearby public automatic license plate reader (ALPR) records and preparing a new report for DeFlock's documented OpenStreetMap workflow.

## What it does

- Gets a one-time high-accuracy location from the paired phone.
- Queries nearby public ALPR nodes from OpenStreetMap through the Overpass API.
- Sorts results by distance and shows the maker, direction, operator, range, and bearing on the Even G2.
- Captures a phone-camera image or selects an album image as a session-only reference.
- Builds the same OSM tag sets used by the DeFlock app's built-in camera profiles.
- Saves report metadata locally and presents phone links to DeFlock's guide and the OSM editor at the captured location.

DeFlock does not publish a direct camera-submission API. Its official app uploads authenticated edits to OpenStreetMap, while its legacy web workflow sends contributors through the OSM editor. ALPR Scout intentionally hands off to that supported review flow instead of claiming an automatic upload.

## Glasses controls

- Swipe up/down: change the selected item or report value.
- Press: open the selected item or advance the report wizard.
- Double-press: go back; from the home screen, open the required system exit dialog.

## Development

Requirements: Node.js 22+, npm, the Even Hub simulator, and an Even G2 setup with Developer Mode for hardware testing.

```powershell
npm install
npm run dev
evenhub-simulator http://localhost:5173
```

Run verification and create the Even Hub package:

```powershell
npm test
npm run build
npm run pack
```

The packaged output is `alpr-scout.ehpk`. Before a public submission, confirm that `dev.coreydavis.alprscout` is the desired package ID and complete real-device beta testing with the phone locked.

## Data and attribution

Nearby results come from OpenStreetMap contributors and are available under the ODbL. The camera profile names and tag conventions track the public [FoggedLens/deflock-app](https://github.com/FoggedLens/deflock-app) project. Reports must describe publicly visible surveillance infrastructure, and contributors should verify the location, direction, and tags before saving an OSM edit.

