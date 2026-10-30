# Alerts API

Installer admins manage `/api/v1/admin/alert-rules`, list `/api/v1/admin/security-events`, and inspect `/api/v1/admin/detectors`. Authenticated users use `/api/v1/security-events`; clients see only cameras currently assigned `camera:events`. Clients may acknowledge visible events; resolution is installer-admin only.

Trusted ingestion uses `/api/v1/ingest/gateway/events` with Gateway authentication or `/api/v1/ingest/ai/events` with worker credentials and an authorized READY/RUNNING detector. Timestamps, confidence, ownership and idempotency are enforced.

Schedules use IANA zones through the platform `Intl` database, including daylight-saving changes, weekday/weekend selection, overnight windows and holiday dates.
