# BookMyCCTV Mobile

Expo SDK 58 / React Native application for Android and iOS. Production screens use the BookMyCCTV API; fixture data is reachable only through the `__DEV__` preview controls.

## Configure the API origin

Create `apps/mobile/.env.local` (ignored by Git):

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://YOUR_REACHABLE_API_HOST:3000
```

Use `127.0.0.1` only when the app and API run on the same host. Android Emulator commonly reaches the Windows host through `10.0.2.2`; physical devices require the computer's LAN address and firewall access. Production builds must use HTTPS.

## Run on Windows PowerShell

```powershell
Copy-Item .env.example .env
# Edit .env with real secrets and environment-specific URLs.
docker compose up -d mongodb mediamtx
npm install
npm run dev --workspace=@bookmycctv/api
```

In a second terminal:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = 'http://YOUR_REACHABLE_API_HOST:3000'
npm run start --workspace=@bookmycctv/mobile
npm run android --workspace=@bookmycctv/mobile
```

An iOS simulator requires macOS. A physical iOS device can connect through an appropriate Expo development environment.

## Security and media

- Refresh tokens are stored with `expo-secure-store`; access tokens remain in memory.
- A single-flight refresh gate prevents concurrent refresh-token rotation conflicts.
- The player requests expiring HLS sessions and sends the short-lived playback token as an Authorization header. Raw RTSP URLs and camera credentials never enter navigation or mobile state.
- WHEP playback is not enabled in mobile yet. Secure-gateway media relay remains unavailable in the backend.
- Enabling Push preferences on a physical device requests notification permission, obtains an Expo token for the configured EAS project, and registers it with the existing backend. Remote delivery still requires `expo.extra.eas.projectId`, Android/iOS push credentials, and backend `PUSH_ENABLED=true`.

## Checks

```powershell
npm run typecheck --workspace=@bookmycctv/mobile
npm run lint --workspace=@bookmycctv/mobile
npm run test --workspace=@bookmycctv/mobile
npx expo-doctor@latest apps/mobile
```
