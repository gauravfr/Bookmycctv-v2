# Authentication, authorization, and tenancy

## Credential lifecycle

Argon2id hashes user passwords with costs configured through validated environment variables. Login returns a short-lived HS256 access token and a cryptographically random refresh credential suitable for mobile secure storage. Only the refresh secret's SHA-256 digest is stored. Rotation revokes the predecessor; presenting a revoked token is treated as reuse and revokes every active session in that family. Logout revokes one session, while logout-all, password changes, resets, and suspension revoke all refresh sessions.

JWT verification pins `HS256`, issuer, audience, and expiration. Authentication also reloads the user and organization so account or tenant suspension takes effect without waiting for token expiry. Password changes invalidate older access tokens through `passwordChangedAt`.

## Authorization and isolation

Every protected route authenticates first, then applies role and forced-password guards. Organization IDs for installer operations come only from the authenticated user, never request bodies. Client lookups include both `_id` and `organizationId`; a valid cross-tenant ObjectId therefore returns no resource. Mutable fields are explicitly selected by Zod schemas to prevent mass assignment.

Platform admins do not automatically receive camera-stream credentials. Installer admins are tenant-scoped. Clients receive only explicit assignment identifiers and permissions. Camera actions require both an assignment permission and, after Prompt 3, a supported camera capability.

## Camera assignment boundary

The assignment model and permission checks exist, but assignment writes call `CameraResourceValidator`. Milestone 2 installs a fail-closed validator returning `CAMERA_INTEGRATION_PENDING`; Prompt 3 must replace it with a tenant-aware Camera lookup and capability validator. This prevents assignments to invented camera IDs.

## Audit and sensitive data

Audit records capture actor, action, target, organization, timestamp, and allowlisted metadata. They never store passwords, access tokens, refresh tokens, RTSP URLs, or device credentials. Failed login records use a one-way normalized-username digest rather than plaintext.
