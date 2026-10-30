# Device API

All routes require authentication. Admin mutation routes require an active `INSTALLER_ADMIN`, completed password change, and tenant ownership.

| Method           | Path                                        | Purpose                                    |
| ---------------- | ------------------------------------------- | ------------------------------------------ |
| GET              | `/api/v1/devices/brands`                    | Supported enum metadata                    |
| GET              | `/api/v1/devices/field-definitions`         | Dynamic form metadata                      |
| POST/GET         | `/api/v1/admin/devices`                     | Create/list tenant devices                 |
| GET/PATCH/DELETE | `/api/v1/admin/devices/:id`                 | Read/update/soft-delete                    |
| POST             | `/api/v1/admin/devices/:id/test-connection` | Authenticated ONVIF and optional RTSP test |
| POST             | `/api/v1/admin/devices/:id/discover`        | Idempotent channel discovery               |
| POST             | `/api/v1/admin/devices/:id/reconnect`       | Bounded manual reconnect                   |
| GET              | `/api/v1/admin/devices/:id/health`          | Persisted health state                     |
| GET              | `/api/v1/admin/devices/:id/capabilities`    | Discovered camera capabilities             |
| GET              | `/api/v1/admin/devices/:id/cameras`         | Device cameras                             |
| GET              | `/api/v1/cameras`                           | Tenant/assignment-scoped cameras           |
| GET              | `/api/v1/cameras/:id`                       | Safe camera detail                         |
| GET              | `/api/v1/cameras/:id/capabilities`          | Normalized capabilities                    |
| GET              | `/api/v1/cameras/:id/status`                | Device versus stream status                |

Example registration body: `{ "displayName":"Office NVR", "brand":"DAHUA", "deviceType":"NVR", "connectionMethod":"LOCAL_LAN", "hostname":"192.168.1.20", "username":"admin", "password":"placeholder-only", "onvifPort":80, "rtspPort":554 }`. Credentials and authenticated URIs never appear in responses.
