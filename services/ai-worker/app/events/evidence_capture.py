from dataclasses import dataclass
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import cv2
import time

@dataclass(frozen=True)
class Evidence:
    file_name: str
    sha256: str
    captured_at: str

class EvidenceCapture:
    def __init__(self, root: Path, quality: int = 85):
        self.root = root
        self.quality = quality
        self.root.mkdir(parents=True, exist_ok=True)

    def capture(self, camera_id: str, event_type: str, frame) -> Evidence:
        captured = datetime.now(timezone.utc)
        safe_camera = "".join(character for character in camera_id if character.isalnum() or character in "-_")
        file_name = f"{safe_camera}-{event_type.lower()}-{captured.strftime('%Y%m%dT%H%M%S%fZ')}.jpg"
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, self.quality])
        if not ok: raise RuntimeError("JPEG evidence encoding failed")
        payload = encoded.tobytes()
        (self.root / file_name).write_bytes(payload)
        return Evidence(file_name, hashlib.sha256(payload).hexdigest(), captured.isoformat())

    def prune(self, max_age_days: int) -> int:
        cutoff = time.time() - max_age_days * 86400
        removed = 0
        for file_path in self.root.glob('*.jpg'):
            if file_path.stat().st_mtime < cutoff:
                file_path.unlink()
                removed += 1
        return removed
