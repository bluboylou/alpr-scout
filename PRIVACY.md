# ALPR Scout Privacy Notice

ALPR Scout does not operate an account system, analytics service, advertising system, or developer-controlled backend.

## Permissions and data use

- **Location:** The paired phone provides a one-time location to find nearby public ALPR records and position a new report. Nearby lookups send the latitude, longitude, and search radius to the public OpenStreetMap Overpass service at `overpass-api.de`.
- **Camera and album:** A selected image is held in the app's memory as a reference during the current session. ALPR Scout does not upload the image. The user may separately follow DeFlock's documented Wikimedia Commons process if they choose to publish a photo.
- **Network:** The app queries `overpass-api.de` and provides user-initiated links to `deflock.org` and `openstreetmap.org` for reviewing and completing a report.
- **Local storage:** The most recent report's coordinates, accuracy, selected profile, mount, direction, photo filename, photo media type, and OSM tags are saved locally through the Even Hub SDK. The photo contents are not saved in the report record.

## Sharing and deletion

No information is sent to the app developer. Data reaches OpenStreetMap or another external service only when the user follows a handoff link and completes that service's submission flow. Removing the app clears app-controlled local data according to the Even Realities App's storage behavior.

