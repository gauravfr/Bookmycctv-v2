# Notifications API

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/mark-all-read`
- `GET|PUT /api/v1/notification-preferences`
- `POST /api/v1/push-tokens`
- `DELETE /api/v1/push-tokens/:id`

`POST /api/v1/auth/logout` optionally accepts `pushTokenId` to revoke the current device token. Actual push validation requires an Expo mobile build and physical device.
