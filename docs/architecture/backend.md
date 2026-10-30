# Backend architecture

The API is assembled in `app.ts` and started in `server.ts`, keeping HTTP tests listener-free. Routes return transport responses; future controllers translate HTTP input; services enforce business rules; repositories alone access Mongoose. Zod owns configuration and future request schemas. Errors and responses share one safe envelope.

Domain modules under `apps/api/src/modules` will isolate auth, users, organizations, devices, cameras, assignments, gateways, streams, alerts, notifications, and AI contracts. Planned authorization will combine platform-admin, installer/admin, and client roles with organization membership and resource assignments; no public registration exists.

Vendor code belongs behind connector interfaces in `services/device-connectors/{dahua,cp-plus,hikvision,onvif}`. Capabilities must be discovered and normalized, never assumed. Credentials, RTSP URLs, and tokens must remain encrypted/restricted and never appear in unauthenticated responses or logs.

The edge gateway will own authenticated on-site access and local-network discovery. Remote access must use a supported authenticated connection or relay, not automatic port forwarding or public RTSP exposure. The future media gateway will authorize short-lived viewing sessions and may optionally use FFmpeg, but FFmpeg is not an API startup dependency.

The AI worker will be separately deployable and consume explicitly authorized media/event inputs. The API will store metadata and coordinate alerts rather than perform inference in request handlers.

Security foundations include validated settings, explicit CORS, Helmet, payload limits, rate limiting, redacted logs, correlation IDs, safe production errors, dependency readiness, and explicit proxy-hop configuration. Production deployment should add TLS at Nginx, network restrictions, secret management, least-privilege MongoDB access, backups, monitoring, and auditable authorization.
