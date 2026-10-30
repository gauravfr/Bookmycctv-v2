import hashlib
import json
import threading

import numpy as np

from app.detectors.object_detector import Detection, YoloOnnxDetector
from app.inference.model_loader import ModelManifest, load_manifest
from app.inference.inference_engine import DetectorRegistry
from app.inference.preprocessing import letterbox
from app.detectors.specialized import detector_specs


class FakeNetwork:
    def __init__(self, output):
        self.output = output

    def setInput(self, _blob):
        return None

    def forward(self):
        return self.output


def detector(output, output_format="yolo_v8"):
    subject = YoloOnnxDetector.__new__(YoloOnnxDetector)
    subject.manifest = ModelManifest(
        "test", "1", None, ("person", "car"), "0" * 64, 640, output_format
    )
    subject.accepted_labels = {"person", "car"}
    subject.threshold = 0.5
    subject.network = FakeNetwork(output)
    subject._lock = threading.Lock()
    return subject


def test_yolov8_decoding_scales_and_clamps_boxes():
    output = np.array([[[320, 320, 700, 700, 0.9, 0.1], [100, 100, 50, 50, 0.1, 0.2]]], dtype=np.float32)
    detections = detector(output).detect(np.zeros((320, 640, 3), dtype=np.uint8))
    assert len(detections) == 1
    assert detections[0].label == "person"
    assert detections[0].box == (0, 0, 640, 320)


def test_yolov5_objectness_is_part_of_confidence():
    output = np.array([[[320, 320, 100, 100, 0.4, 0.99, 0.01], [320, 320, 100, 100, 0.9, 0.8, 0.2]]], dtype=np.float32)
    detections = detector(output, "yolo_v5").detect(np.zeros((640, 640, 3), dtype=np.uint8))
    assert len(detections) == 1
    assert round(detections[0].confidence, 2) == 0.72


def test_letterbox_preserves_aspect_ratio_and_restores_coordinates():
    prepared, transform = letterbox(np.zeros((320, 640, 3), dtype=np.uint8), 640)
    assert prepared.shape == (640, 640, 3)
    assert transform.pad_y == 160
    assert transform.restore_box(320, 320, 200, 100) == (220, 110, 200, 100)


def test_sharp_object_preserves_coco_scissors_and_uses_verified_knife_model():
    assert detector_specs["SHARP_OBJECT"].manifest_name == "coco.json"
    assert detector_specs["SHARP_OBJECT"].labels == {"scissors"}
    assert detector_specs["SHARP_OBJECT_KNIFE"].manifest_name == "sharp-knife.json"
    assert detector_specs["SHARP_OBJECT_KNIFE"].labels == {"knife"}


def test_registry_selects_only_models_required_by_active_events():
    registry = DetectorRegistry.__new__(DetectorRegistry)
    registry.specs = detector_specs
    registry.kind_models = {
        "PERSON": "coco.json",
        "SHARP_OBJECT": "coco.json",
        "SHARP_OBJECT_KNIFE": "sharp-knife.json",
        "FIRE": "fire-smoke.json",
        "SMOKE": "fire-smoke.json",
    }
    assert registry.model_names_for_event_types({"CROWD_GATHERING", "SHARP_OBJECT_DETECTED"}) == {"coco.json", "sharp-knife.json"}
    assert registry.model_names_for_event_types({"FIRE_VISUAL_INDICATOR", "SMOKE_VISUAL_INDICATOR"}) == {"fire-smoke.json"}
    assert registry.model_names_for_event_types({"NO_MOVEMENT_DETECTED"}) == set()


def test_registry_combines_knife_and_scissors_without_relabelling():
    registry = DetectorRegistry.__new__(DetectorRegistry)
    registry.specs = detector_specs
    registry.kind_models = {
        "SHARP_OBJECT": "coco.json",
        "SHARP_OBJECT_KNIFE": "sharp-knife.json",
    }
    outputs = {
        "coco.json": [Detection("scissors", 0.8, (1, 2, 3, 4)), Detection("person", 0.9, (1, 2, 3, 4))],
        "sharp-knife.json": [Detection("knife", 0.7, (5, 6, 7, 8))],
    }
    detections = registry.detections_for("SHARP_OBJECT_DETECTED", outputs, crowd_count=3)
    assert [(item.label, item.confidence) for item in detections] == [("scissors", 0.8), ("knife", 0.7)]


def test_registry_returns_actual_people_before_crowd_rule_thresholding():
    registry = DetectorRegistry.__new__(DetectorRegistry)
    registry.kind_models = {"PERSON": "coco.json"}
    outputs = {"coco.json": [Detection("person", 0.9, (1, 2, 3, 4)), Detection("person", 0.4, (5, 6, 7, 8))]}
    detections = registry.detections_for("CROWD_GATHERING", outputs, crowd_count=3)
    assert len(detections) == 2


def test_manifest_requires_hash_and_explicit_output_format(tmp_path):
    model = tmp_path / "model.onnx"
    model.write_bytes(b"reviewed model bytes")
    manifest = tmp_path / "model.json"
    manifest.write_text(json.dumps({
        "modelId": "test", "version": "1", "file": model.name,
        "labels": ["person"], "sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
        "inputSize": 640, "outputFormat": "yolo_v8"
    }))
    assert load_manifest(manifest).output_format == "yolo_v8"
    manifest.write_text(manifest.read_text().replace('"yolo_v8"', '"unknown"'))
    try:
        load_manifest(manifest)
        assert False, "unsupported output format must fail"
    except ValueError:
        pass
