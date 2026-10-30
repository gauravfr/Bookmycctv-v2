# Streaming architecture

BookMyCCTV uses MediaMTX 1.21.2 (MIT license) as the media plane. The Node API remains the control plane: it authorizes a camera, decrypts its RTSP source only in memory, registers an on-demand MediaMTX path, waits for `online: true` and non-empty tracks, and only then returns a short-lived playback descriptor. Failed provisioning returns an explicit error and no playback URL.

MediaMTX pulls RTSP over TCP and shares one camera path across viewers. HLS is exposed at `/hls/<path>/index.m3u8`; WebRTC uses WHEP at `/webrtc/<path>/whep`. Both send the session token in the Authorization header. MediaMTX delegates every read/playback request to the API, which rechecks token expiry, revocation, user status, tenant, and current camera assignment. Camera credentials and source URLs never reach clients or MongoDB logs.

H.264 is the preferred mobile codec. H.265 is allowed for HLS only when the eventual native player/device supports it; this release rejects H.265 WebRTC. Audio metadata is capability-aware, but talkback is not implemented and must not be presented as operational.

FFmpeg is not required at API startup. Transcoding is intentionally absent; incompatible codecs fail explicitly instead of silently consuming VPS CPU.
