# Remote access

The public surface is HTTPS API, authenticated HLS/WHEP, and WebRTC ICE. MongoDB, MediaMTX control/RTSP ports, ONVIF, and camera admin ports remain private. Nginx terminates TLS. MediaMTX's control API is reachable only on the Compose network; its HTTP auth callback is also internal-only in production firewall policy.

An edge gateway enrolls with a single-use token and receives a random signed credential. It initiates outbound HTTPS heartbeats. Rotation invalidates the old secret immediately; revocation removes it. Commands are allowlisted and there is no shell or general-purpose tunnel.

The supplied edge agent implements enrollment, secure credential authentication, and health only. It deliberately advertises no `RTSP_RELAY` capability. Consequently `SECURE_GATEWAY` stream requests fail with `GATEWAY_MEDIA_ROUTE_UNAVAILABLE` until a reviewed outbound publisher/relay transport is added and verified. This prevents local reachability from being fabricated.

WebRTC deployments need UDP 8189 plus a public additional host/Candidate configuration. Restrictive mobile networks require a TURN server (typically UDP/TCP 3478 and TLS 5349) with time-limited credentials. HLS works over 443 and trades latency for compatibility.
