from __future__ import annotations
from datetime import datetime, timezone
import hashlib

def build_event(camera_id: str, event_type: str, detector_id: str, version: str, confidence: float, count: int, metadata: dict | None = None) -> dict:
    occurred = datetime.now(timezone.utc)
    bucket = int(occurred.timestamp())
    source = hashlib.sha256(f"{camera_id}:{detector_id}:{bucket}".encode()).hexdigest()
    return {"cameraId": camera_id, "eventType": event_type, "occurredAt": occurred.isoformat(), "sourceEventId": source, "confidence": confidence, "detectorId": detector_id, "detectorVersion": version, "metadata": {"objectCount": count, "inferenceVerified": True, **(metadata or {})}}
