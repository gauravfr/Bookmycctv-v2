# Security events

Trusted gateway or AI worker input is validated, tenant-bound, timestamp-checked, normalized, SHA-256 deduplicated, evaluated against camera/organization rules, persisted, and queued for notification. Important work uses MongoDB-backed jobs with atomic claiming, bounded attempts, exponential backoff and dead state; no critical queue is in memory.

ONVIF/vendor event subscription is not yet implemented: existing connectors discover capabilities and streams only. Hardware events therefore enter through an authenticated gateway integration. Offline monitoring is also pending a real periodic media probe; reachability alone is never treated as video health.

Events retain safe scalar metadata only. They never contain device credentials, RTSP URLs, access tokens, or public evidence links. TTL cleanup follows explicit retention dates and does not touch recorder footage.
