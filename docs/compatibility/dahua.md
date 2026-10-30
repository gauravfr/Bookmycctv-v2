# Dahua compatibility

Uses ONVIF device/media/PTZ discovery when enabled by the model. The documented `/cam/realmonitor?channel=N&subtype=N` RTSP pattern is available as a fallback template, but connection success is never assumed from the brand. Firmware-specific events, storage, AI, audio, and PTZ remain `UNKNOWN` or `UNSUPPORTED` unless returned by ONVIF. No Dahua cloud/P2P SDK is implemented or claimed tested.
