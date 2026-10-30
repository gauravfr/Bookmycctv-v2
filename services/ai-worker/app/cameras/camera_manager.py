import threading
import hashlib
import json
from app.cameras.stream_reader import StreamReader
from app.events.event_builder import build_event
from app.tracking.temporal_filter import TemporalFilter
from app.events.evidence_capture import EvidenceCapture
from app.events.annotator import annotate
from app.tracking.motion_analyzer import MotionAnalyzer

class CameraManager:
    def __init__(self, backend, registry, settings, stopped, log):
        self.backend, self.registry, self.settings, self.stopped, self.log = backend, registry, settings, stopped, log
        self.threads = {}
        self.camera_stops = {}
        self.camera_configs = {}
        self.evidence = EvidenceCapture(settings.evidence_dir)
        self.evidence.prune(settings.evidence_max_age_days)
    def reconcile(self, cameras):
        active = {camera["cameraId"] for camera in cameras[: self.settings.max_cameras]}
        for camera_id in set(self.threads).difference(active):
            self.camera_stops[camera_id].set()
            self.threads.pop(camera_id, None)
            self.camera_stops.pop(camera_id, None)
            self.camera_configs.pop(camera_id, None)
        for camera in cameras[: self.settings.max_cameras]:
            camera_id = camera["cameraId"]
            fingerprint = hashlib.sha256(json.dumps(camera, sort_keys=True).encode()).hexdigest()
            if camera_id in self.threads and self.threads[camera_id].is_alive() and self.camera_configs.get(camera_id) == fingerprint:
                continue
            if camera_id in self.threads and self.threads[camera_id].is_alive():
                self.camera_stops[camera_id].set()
            camera_stop = threading.Event()
            thread = threading.Thread(target=self._run, args=(camera, camera_stop), daemon=True, name=f"camera-{camera_id}")
            self.camera_stops[camera_id] = camera_stop
            self.camera_configs[camera_id] = fingerprint
            self.threads[camera_id] = thread; thread.start()
    def _run(self, camera, camera_stop):
        camera_id = camera["cameraId"]; temporal = TemporalFilter(3); motion = MotionAnalyzer()
        inference_event_types = {
            rule["eventType"]
            for rule in camera.get("detectors", [])
            if rule["eventType"] != "NO_MOVEMENT_DETECTED"
        }
        reader = StreamReader(camera["rtspUri"], self.settings.sample_fps, self.settings.reconnect_min_seconds, self.settings.reconnect_max_seconds)
        self.log.info("Camera worker started camera=%s", camera_id)
        try:
            for frame in reader.frames(camera_stop, self.stopped):
                outputs = self.registry.infer_frame(frame, inference_event_types)
                motion_state = motion.update(frame)
                for rule in camera.get("detectors", []):
                    event_type = rule["eventType"]
                    try:
                        if event_type == "NO_MOVEMENT_DETECTED":
                            required = float(rule.get("inactivitySeconds", 300))
                            cooldown = float(rule.get("cooldownSeconds", 300))
                            if not motion.should_emit(motion_state, required, cooldown):
                                continue
                            annotated = annotate(frame, [], f"NO MOVEMENT {motion_state.inactivity_seconds:.0f}s")
                            evidence = self.evidence.capture(camera_id, event_type, annotated)
                            metadata = {
                                "evidenceFile": evidence.file_name,
                                "evidenceSha256": evidence.sha256,
                                "evidenceCapturedAt": evidence.captured_at,
                                "inactivitySeconds": round(motion_state.inactivity_seconds, 2),
                                "changedPixelRatio": round(motion_state.changed_ratio, 6),
                                "frozenVideo": False,
                            }
                            self.backend.send_event(build_event(camera_id, event_type, "motion-analytics", "1.0", 1.0, 0, metadata))
                            continue
                        latency_ms, inference_error = self.registry.telemetry_for(event_type)
                        if inference_error:
                            self.log.error("Model inference failed camera=%s type=%s error=%s", camera_id, event_type, inference_error)
                            continue
                        detections = self.registry.detections_for(event_type, outputs, int(rule.get("crowdCount", 3)))
                        detections = [item for item in detections if item.confidence >= float(rule.get("confidence", 0.5))]
                        detected = bool(detections)
                        if event_type == "CROWD_GATHERING":
                            detected = len(detections) >= int(rule.get("crowdCount", 3))
                        max_gap = max(2.0 / max(float(self.settings.sample_fps), 0.01), 1.0)
                        if not temporal.accept(f"{camera_id}:{event_type}", detected, int(rule.get("cooldownSeconds", 60)), float(rule.get("persistenceSeconds", 0)), max_gap_seconds=max_gap): continue
                        detector_id, version = self.registry.version(event_type)
                        person_count = len(detections) if event_type == "CROWD_GATHERING" else None
                        annotated = annotate(frame, detections, event_type.replace("_", " "), person_count)
                        evidence = self.evidence.capture(camera_id, event_type, annotated)
                        metadata = {"evidenceFile": evidence.file_name, "evidenceSha256": evidence.sha256, "evidenceCapturedAt": evidence.captured_at, "inferenceLatencyMs": latency_ms, **({"personCount": person_count} if person_count is not None else {})}
                        self.backend.send_event(build_event(camera_id, event_type, detector_id, version, max(item.confidence for item in detections), len(detections), metadata))
                    except KeyError: continue
                    except Exception as error: self.log.error("Inference failed camera=%s type=%s error=%s", camera_id, event_type, type(error).__name__)
        finally: self.log.info("Camera worker stopped camera=%s", camera_id)
