# Opt-in CCTV integration tests

Automated tests use controlled mocks and are not evidence of real video. For each authorized Dahua, CP Plus, and Hikvision unit: allow its subnet, create/test/discover the device, start MediaMTX, request HLS then WebRTC, and confirm moving video plus `lastSuccessfulVideoAt`. Repeat through an edge relay only after it reports a verified `RTSP_RELAY` capability.

Test mobile data with Wi-Fi disabled, including TURN-only networks. During playback disconnect the camera, disconnect the gateway, revoke the user assignment, suspend the organization, and revoke the gateway; access must stop and health must degrade without losing capability metadata. Never place hardware credentials in fixtures or commit them.

PowerShell: `npm ci; npm run build; npm run typecheck; npm run lint; npm test`. Linux: `docker compose config && docker compose up -d --build`. Media process health can be checked privately with `curl http://127.0.0.1:9997/v3/paths/list` from the MediaMTX network namespace.
