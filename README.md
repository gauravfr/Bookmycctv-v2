# BookMyCCTV V2 backend

Production-oriented TypeScript/Express backend for CCTV accounts, devices, secure playback sessions, gateways, controls, security events, alert rules and notifications. Implemented through milestone 5; real hardware, Expo-device and AI-model verification remain pending.

## Prerequisites and installation

- Node.js 22 LTS or newer supported LTS
- npm 10+
- MongoDB Atlas, or optional Docker Desktop for local MongoDB

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Set `MONGODB_URI` in `.env`; never commit it. For Atlas, create a database user with only required privileges, allow the server's IP in Network Access, copy the Node connection URI, and replace its placeholders locally. For local MongoDB run `docker compose up -d mongodb` and retain the example URI.

## Commands

`npm run dev`, `build`, `start`, `test`, `lint`, `typecheck`, and `format` are available at the repository root. Production startup requires `npm run build` followed by `npm start`.

## API

- `GET /api/v1` — service metadata
- `GET /api/v1/health` — process liveness; does not imply database readiness
- `GET /api/v1/ready` — returns 200 only when MongoDB is connected, otherwise 503

Responses use `{ success, data|error, meta: { requestId } }`. Send `x-request-id` for correlation; otherwise the API generates one.

## Configuration and proxying

Every variable is documented in `.env.example`. `CORS_ORIGINS` must be a comma-separated explicit allowlist. `TRUST_PROXY=0` is safe for direct development. Behind one controlled Nginx hop, set it to `1` and ensure clients cannot bypass Nginx; never blindly enable `true`.

## Troubleshooting

- Startup exits with configuration details when required settings are missing or malformed.
- A MongoDB startup failure usually means the URI, Atlas IP allowlist, DNS, credentials, or local container is unavailable. Secrets are not logged.
- A 503 from `/ready` means a required dependency is unavailable; `/health` can still be 200.
- On restricted Windows sandboxes that forbid workspace symlinks, install root and API dependencies separately with `npm install --workspaces=false`; ordinary machines should use `npm install`.

## Scope

Implemented through milestone 4: encrypted Dahua, CP Plus, and Hikvision registration; ONVIF discovery and controls; bounded RTSP negotiation; tenant-safe assignments; fail-closed MediaMTX HLS/WebRTC provisioning; revocable stream sessions; gateway enrollment/heartbeat; and deployment configuration. The edge agent intentionally provides enrollment and health only—outbound RTSP relay is pending and gateway-routed playback fails explicitly until that transport is implemented and tested. Persistent health scheduling, digest-auth snapshot support, talkback, alert delivery, AI processing, real-camera playback, and remote mobile-data verification remain pending.

Milestone 5 adds normalized, deduplicated security events, timezone-aware alert rules, after-hours derivation, Mongo-backed durable notification jobs, in-app notifications, encrypted Expo push tokens, trusted gateway/AI ingestion and detector lifecycle reporting. Actual ONVIF/vendor subscriptions, offline probing, Expo receipt reconciliation and neural-network inference remain partial or unavailable and are never reported as operational.

Streaming and deployment details are in `docs/architecture/streaming.md`, `docs/architecture/remote-access.md`, and `docs/deployment/hostinger-vps.md`. The repository never treats configuration or mock tests as proof of real video delivery.

Device credentials require a separate 32-byte base64 `DEVICE_CREDENTIAL_KEY_BASE64` and `DEVICE_CREDENTIAL_KEY_ID`. Generate a key in PowerShell with `$bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToBase64String($bytes)`. Configure approved camera networks in `DEVICE_ALLOWED_CIDRS`; do not broadly allow unrelated internal infrastructure. For rotation, set the new primary key and retain old key-ID mappings temporarily in `DEVICE_CREDENTIAL_PREVIOUS_KEYS_JSON`, then update device credentials to re-encrypt them.

## Authentication and account setup

Passwords use configurable Argon2id. Access tokens are short-lived HS256 JWTs constrained by issuer, audience, algorithm, and expiry. Opaque refresh credentials use `sessionId.secret`, are hashed in MongoDB, rotate on every use, and trigger token-family revocation when reuse is detected. The future Expo application must keep refresh credentials in platform secure storage, never AsyncStorage.

Roles are backend-enforced: `PLATFORM_ADMIN` manages organizations and installer admins; `INSTALLER_ADMIN` manages only clients and assignments in its authenticated organization; `CLIENT` can read only its explicit assignments. Suspended users or organizations are rejected. Temporary-password users may use only `/auth/me`, `/auth/change-password`, and logout operations until the password changes.

First-time sequence:

1. Configure MongoDB and all `.env` settings.
2. Start MongoDB.
3. Temporarily set `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, and `BOOTSTRAP_ADMIN_DISPLAY_NAME`.
4. Run `npm run admin:bootstrap`, then remove the bootstrap password from the environment.
5. Log in as platform admin and create an organization and installer admin.
6. Log in as installer admin, change the temporary password, and create clients.
7. Camera assignment activation waits for Prompt 3 camera integration.
8. Clients log in and change their temporary passwords.

The bootstrap command safely refuses to run when a platform admin already exists. There is no public bootstrap or registration endpoint.

### Authentication API

| Method                | Endpoint                                    | Access                                       |
| --------------------- | ------------------------------------------- | -------------------------------------------- |
| POST                  | `/api/v1/auth/login`                        | Public, throttled                            |
| POST                  | `/api/v1/auth/refresh`                      | Refresh credential, throttled                |
| POST                  | `/api/v1/auth/logout`                       | Authenticated                                |
| POST                  | `/api/v1/auth/logout-all`                   | Authenticated                                |
| GET                   | `/api/v1/auth/me`                           | Authenticated                                |
| POST                  | `/api/v1/auth/change-password`              | Authenticated                                |
| POST/GET/PATCH        | `/api/v1/platform/organizations...`         | Platform admin                               |
| POST/GET              | `/api/v1/platform/organizations/:id/admins` | Platform admin                               |
| PATCH                 | `/api/v1/platform/users/:id/status`         | Platform admin                               |
| POST/GET/PATCH        | `/api/v1/admin/clients...`                  | Installer admin, same organization           |
| POST                  | `/api/v1/admin/clients/:id/reset-password`  | Installer admin, same organization           |
| POST/GET/PATCH/DELETE | `/api/v1/admin/clients/:id/cameras...`      | Installer admin; writes gated until Prompt 3 |
| GET                   | `/api/v1/client/cameras`                    | Client; assignment metadata only             |

Login bodies contain `username` and `password`. Refresh and logout bodies contain `refreshToken`. Login/refresh responses return `accessToken`, `accessTokenExpiresInSeconds`, `refreshToken`, `refreshTokenExpiresAt`, and a safe user profile. Password hashes and camera credentials are never serialized.
