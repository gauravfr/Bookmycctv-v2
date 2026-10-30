# Streams and controls API

All client routes require a Bearer access token. Client users need the current camera assignment permission; installer admins are limited to their organization.

- `POST /api/v1/cameras/:id/streams` with `{ "transport": "WEBRTC" | "HLS" }`
- `GET /api/v1/cameras/:id/streams`
- `GET /api/v1/streams/:sessionId`
- `POST /api/v1/streams/:sessionId/refresh`
- `DELETE /api/v1/streams/:sessionId`
- `GET /api/v1/streams/:sessionId/health`
- `POST /api/v1/cameras/:id/ptz/move`, `.../stop`, `GET .../presets`, `POST .../presets/:presetId/goto`
- `POST /api/v1/cameras/:id/snapshots` returns a no-store JPEG/PNG response.

The playback token is returned only on create/refresh and is stored only as SHA-256. It belongs in an Authorization header, never a query string. The media URL is absent unless MediaMTX confirms actual tracks.
