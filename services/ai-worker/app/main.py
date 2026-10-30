from __future__ import annotations
import signal
import threading
import os
from app.config.settings import Settings
from app.inference.inference_engine import DetectorRegistry
from app.cameras.camera_manager import CameraManager
from app.integrations.backend_client import BackendClient
from app.utils.logging import configure_logging

def main() -> None:
    settings = Settings.from_env(); log = configure_logging(); stopped = threading.Event()
    backend = BackendClient(settings.api_url, settings.secret, settings.organization_id, settings.worker_id)
    registry = DetectorRegistry(settings.model_dir, os.getenv("AI_USE_CUDA", "false").lower() == "true")
    manager = CameraManager(backend, registry, settings, stopped, log)
    def shutdown(*_): stopped.set()
    signal.signal(signal.SIGINT, shutdown); signal.signal(signal.SIGTERM, shutdown)
    while not stopped.is_set():
        try:
            backend.heartbeat(registry.statuses)
            ready = [item for item in registry.statuses if item["state"] in ("READY", "RUNNING")]
            if ready: manager.reconcile(backend.cameras())
            else: log.warning("No validated detector models are ready; inference is not running")
        except Exception as error: log.error("Worker cycle failed: %s", type(error).__name__)
        stopped.wait(30)

if __name__ == "__main__": main()
