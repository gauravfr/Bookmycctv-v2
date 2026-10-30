# Hostinger VPS deployment

Use a Linux VPS with Docker Engine/Compose, a DNS name, and enough outbound bandwidth. Copy `.env.example` to `.env`, replace every secret, set `MONGODB_URI=mongodb://mongodb:27017/bookmycctv_v2`, `HOST=0.0.0.0`, `TRUST_PROXY=1`, and enable the media gateway only after network policy is reviewed.

Run `docker compose config`, then `docker compose up -d --build`. Put Nginx (or the Hostinger proxy) in front using `infrastructure/deployment/nginx.conf` and obtain/renew certificates with the platform's ACME integration. Allow inbound 80/443 and UDP 8189 for WebRTC; add TURN ports only when TURN is deployed. Deny public 27017, 554, 8554, 9997, 9998, and camera/ONVIF ports. Permit the API/media containers to reach only approved camera or gateway networks.

Resource limits must be tuned after measured load. Start with bounded API stream limits, Docker memory/CPU limits, log rotation, restart `unless-stopped`, and bandwidth monitoring. A static public IP does not replace TLS, media authorization, TURN, or firewalling.

The deployment includes a Mongo-backed background job runner and optional `ai-worker` Compose profile. Set `JOB_WORKER_ENABLED=true` on exactly one API replica unless job workers are separated. The worker performs inference only when reviewed ONNX weights and valid manifests are mounted; missing models remain `MODEL_UNAVAILABLE`. Configure daily Atlas backups, encrypted evidence storage, Docker log rotation, image-tagged releases and rollback to the previous image. Never expose job, detector, MongoDB or media-control interfaces publicly.
