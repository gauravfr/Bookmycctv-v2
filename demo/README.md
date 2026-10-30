# BookMyCCTV V2 client demo

All commands below must be run from `C:\Users\pande\Downloads\BookMyCCTV-V2` in VS Code PowerShell.

## Verified evidence (no Docker required)

- `demo\output\sharp-positive.mp4`: real scissors detections with boxes, labels and confidence.
- `demo\output\sharp-negative-crowd.mp4`: crowded-room negative control; no sharp detections.
- `demo\output\crowd-persistent.mp4`: people boxes/count, threshold 3, and the production temporal filter accepting a persistent 3-second crowd condition.
- `demo\output\crowd-negative-scissors.mp4`: scissors video negative control; no crowd condition.
- `demo\output\no-movement-evidence.jpg` and `no-movement-summary.json`: event produced after 300 continuous real elapsed seconds. The verifier took over five wall-clock minutes and rejected frozen frames.

Open an annotated video in VS Code or Windows:

```powershell
Start-Process .\demo\output\sharp-positive.mp4
Start-Process .\demo\output\crowd-persistent.mp4
Start-Process .\demo\output\no-movement-evidence.jpg
```

## Start the existing stack

Do not reset Docker or delete volumes. In a normal VS Code terminal:

```powershell
docker version
docker compose up -d mongodb mediamtx api
docker compose ps
docker compose --profile ai up -d --build ai-worker
docker compose logs --tail 100 api ai-worker mediamtx
```

If `docker version` reports access denied, first start Docker Desktop normally and reopen VS Code. If it still fails, open an Administrator PowerShell and add the current account to Docker Desktop's standard local group, then sign out/in:

```powershell
net localgroup docker-users $env:USERNAME /add
```

This is the smallest conventional permission repair; it does not disable authentication or reset Docker. Do not run it if the account is already a member.

## Publish the controlled videos through the existing MediaMTX

MediaMTX RTSP is internal to the Docker network in the current compose file. Publish from a temporary FFmpeg container on that network:

```powershell
docker run --rm --network bookmycctv-v2_default -v "${PWD}\demo\assets:/videos:ro" linuxserver/ffmpeg:latest -re -stream_loop -1 -i /videos/sharp-scissors.mp4 -c:v libx264 -preset veryfast -tune zerolatency -an -f rtsp rtsp://mediamtx:8554/demo-sharp
```

Use a second terminal for crowd:

```powershell
docker run --rm --network bookmycctv-v2_default -v "${PWD}\demo\assets:/videos:ro" linuxserver/ffmpeg:latest -re -stream_loop -1 -i /videos/crowd-room.mp4 -c:v libx264 -preset veryfast -tune zerolatency -an -f rtsp rtsp://mediamtx:8554/demo-crowd
```

For the full inactivity test (do not loop it until after the event has fired):

```powershell
docker run --rm --network bookmycctv-v2_default -v "${PWD}\demo\assets:/videos:ro" linuxserver/ffmpeg:latest -re -i /videos/no-movement-305s.mp4 -c:v libx264 -preset veryfast -tune zerolatency -an -f rtsp rtsp://mediamtx:8554/demo-inactivity
```

Register those exact authorized RTSP URLs using the existing admin camera flow. Create existing alert rules with:

- Sharp: `SHARP_OBJECT_DETECTED`, confidence `0.50`, cooldown `60` seconds.
- Crowd: `CROWD_GATHERING`, crowd count `3`, persistence `3` seconds, cooldown `60` seconds.
- Inactivity: `NO_MOVEMENT_DETECTED`, inactivity `300` seconds, cooldown `300` seconds.

Then use the existing event history and camera preview. The live preview remains the source stream; bounding-box video is provided by the verified annotated demo outputs above, while event evidence is annotated by the AI worker.

## Mobile app

Set its existing API URL configuration to the host PC address reachable from the phone, then:

```powershell
npm run start --workspace=@bookmycctv/mobile
```

In-app/backend alerts can be demonstrated once the stack is connected. Do not claim push delivery unless Expo/device credentials are configured and an actual device receives the notification.

## Honest limitations

- Scissors are positively verified. Knife is supported by the current COCO model but not positively verified on the licensed demo video.
- Razor blade and box cutter are not supported by the current verified model; do not present them as working.
- A fully persisted event-history run requires local Docker access, MongoDB and the configured organization/shared worker secret.
- The existing live HLS preview does not burn inference overlays into the stream. The AI-produced event evidence and the annotated verification videos do contain real boxes, labels, confidence and counts.
