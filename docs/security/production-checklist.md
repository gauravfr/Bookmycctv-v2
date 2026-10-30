# Production security checklist

- Replace all example secrets; use a secret manager and documented rotation.
- Restrict CORS and trusted proxy hops; expose only TLS 443 and required WebRTC/TURN ports.
- Keep MongoDB, media control, RTSP, ONVIF and internal ingestion private.
- Enable Atlas least privilege, backups and tested restore; preserve Mongo and evidence volumes.
- Review device CIDR allowlists and tenant authorization.
- Enable jobs and push only after monitoring and Expo credentials are ready.
- Monitor dead jobs, failed push tickets, stale gateways and unavailable detectors.
- Run dependency audit and patch review before each release.
- Validate rollback using the prior image and backward-compatible database schemas.
