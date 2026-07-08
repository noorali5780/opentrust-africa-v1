# Sentinel GPS And Streetmap

Sentinel adds optional location context to the certificate trust loop. It does not replace issuer signatures, consent grants, revocation checks, or verifier disclosure controls.

## Open-source stack

- Map engine: Leaflet
- Basemap data: OpenStreetMap
- GPS source: browser Geolocation API
- Storage in this MVP: browser local storage plus local audit rows
- Paid APIs: none

## What Sentinel Does

- Shows issuer, training, and verifier trust sites on a streetmap.
- Requests a device GPS fix when the user chooses GPS.
- Supports a demo GPS fix for local testing without device permission.
- Compares the current GPS fix with a selected site geofence.
- Creates a Sentinel event with status, risk band, accuracy, distance, source, timestamp, and reason codes.
- Adds the Sentinel check to the local audit context.

## Privacy And Safety

GPS is browser-requested and user-permissioned. The MVP does not send GPS coordinates to a paid third-party map or geocoding API. Sentinel events are local in the current web console unless a future persistent API stores them.

Location evidence is a supporting signal only. Verification must still rely on signed credentials, consent, revocation, dispute state, and audit proof.

## Tile Usage

The development map uses `tile.openstreetmap.org` with visible attribution. For production or high-traffic usage, use a self-hosted tile server or an open tile provider whose usage policy matches the deployment. Do not treat public OpenStreetMap tile servers as a production-scale CDN.

## Future Persistent API

When Sentinel becomes server-backed, add a dedicated `SentinelEvent` table with:

- `id`
- `recordId`
- `issuerId`
- `siteId`
- `lat`
- `lng`
- `accuracyMeters`
- `distanceMeters`
- `status`
- `riskLevel`
- `source`
- `reasonCodes`
- `createdAt`

Store only the location data needed for the trust decision. Keep raw GPS history out of the proof ledger; audit anchors should contain hashes and status references only.
