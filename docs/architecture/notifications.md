# Notifications

Rules generate one in-app notification per event and recipient. Recipients are active organization admins and/or clients currently assigned `camera:events`. Preferences filter event types, severity and selected assigned cameras. Push tokens are ownership-bound, AES-GCM encrypted, hashed for uniqueness and may be revoked explicitly or during logout.

Expo states are distinct: QUEUED, ACCEPTED, CONFIRMED, FAILED and UNKNOWN. An accepted ticket is not proof of delivery. Invalid-device tickets disable their token. Full receipt reconciliation is partially implemented: delayed receipt jobs are persisted, but provider receipt fetching remains pending.
