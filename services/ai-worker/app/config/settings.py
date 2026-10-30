from __future__ import annotations
from dataclasses import dataclass
import os
from pathlib import Path

@dataclass(frozen=True)
class Settings:
    api_url: str
    secret: str
    organization_id: str
    worker_id: str
    sample_fps: float
    max_cameras: int
    reconnect_min_seconds: float
    reconnect_max_seconds: float
    model_dir: Path
    evidence_dir: Path
    evidence_max_age_days: int

    @classmethod
    def from_env(cls) -> "Settings":
        required = {name: os.getenv(name, "").strip() for name in ("API_URL", "AI_WORKER_SHARED_SECRET", "ORGANIZATION_ID")}
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        sample_fps = float(os.getenv("AI_SAMPLE_FPS", "2"))
        max_cameras = int(os.getenv("AI_MAX_CAMERAS", "4"))
        if not 0.1 <= sample_fps <= 30: raise ValueError("AI_SAMPLE_FPS must be between 0.1 and 30")
        if not 1 <= max_cameras <= 64: raise ValueError("AI_MAX_CAMERAS must be between 1 and 64")
        evidence_max_age_days = int(os.getenv("AI_EVIDENCE_MAX_AGE_DAYS", "7"))
        if not 1 <= evidence_max_age_days <= 365: raise ValueError("AI_EVIDENCE_MAX_AGE_DAYS must be between 1 and 365")
        return cls(required["API_URL"].rstrip("/"), required["AI_WORKER_SHARED_SECRET"], required["ORGANIZATION_ID"], os.getenv("WORKER_ID", "ai-worker-1"), sample_fps, max_cameras, float(os.getenv("AI_RECONNECT_MIN_SECONDS", "1")), float(os.getenv("AI_RECONNECT_MAX_SECONDS", "30")), Path(os.getenv("AI_MODEL_DIR", "/models")), Path(os.getenv("AI_EVIDENCE_DIR", "/evidence")), evidence_max_age_days)
