# Gateways API

Installer admin: `POST /admin/gateways/enrollments`, list/get/health, revoke, and rotate endpoints under `/api/v1`. The enrollment token expires, is single-use, and is shown once. Rotation also shows the new secret once.

Agent: `POST /api/v1/gateway/enroll`, then `POST /api/v1/gateway/heartbeat` with `Authorization: Gateway <publicId>.<secret>`. Only `HEARTBEAT`, `RTSP_RELAY`, and `ONVIF_CONTROL` capability names are accepted. Command polling currently returns `NO_GATEWAY_COMMANDS`; arbitrary commands are never accepted.
