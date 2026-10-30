from __future__ import annotations
from dataclasses import dataclass
from .object_detector import Detection, YoloOnnxDetector

@dataclass(frozen=True)
class DetectorSpec:
    event_type: str
    manifest_name: str
    labels: frozenset[str]

detector_specs = {
    "PERSON": DetectorSpec("PERSON_DETECTED", "coco.json", frozenset({"person"})),
    "VEHICLE": DetectorSpec("VEHICLE_DETECTED", "coco.json", frozenset({"car", "bus", "truck", "motorcycle"})),
    "FIRE": DetectorSpec("FIRE_VISUAL_INDICATOR", "fire-smoke.json", frozenset({"fire"})),
    "SMOKE": DetectorSpec("SMOKE_VISUAL_INDICATOR", "fire-smoke.json", frozenset({"smoke"})),
    "SMOKING": DetectorSpec("SMOKING_ACTIVITY", "smoking.json", frozenset({"smoking"})),
    "SHARP_OBJECT": DetectorSpec(
        "SHARP_OBJECT_DETECTED",
        "coco.json",
        frozenset({"scissors"}),
    ),
    "SHARP_OBJECT_KNIFE": DetectorSpec(
        "SHARP_OBJECT_DETECTED",
        "sharp-knife.json",
        frozenset({"knife"}),
    ),
}

class CrowdDetector:
    def __init__(self, person_detector: YoloOnnxDetector, count: int): self.person_detector, self.count = person_detector, count
    def detect(self, frame) -> list[Detection]:
        people = self.person_detector.detect(frame)
        return people if len(people) >= self.count else []
