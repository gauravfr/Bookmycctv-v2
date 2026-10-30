from __future__ import annotations
from dataclasses import dataclass
import cv2
import numpy as np
import threading
from app.inference.model_loader import ModelManifest, load_network
from app.inference.preprocessing import letterbox

@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    box: tuple[int, int, int, int]

class YoloOnnxDetector:
    def __init__(self, detector_id: str, manifest: ModelManifest, accepted_labels: set[str], threshold: float = 0.25, use_cuda: bool = False):
        missing = accepted_labels.difference(manifest.labels)
        if missing: raise ValueError(f"Model {manifest.model_id} lacks required labels: {sorted(missing)}")
        self.detector_id, self.manifest, self.accepted_labels, self.threshold = detector_id, manifest, accepted_labels, threshold
        self.network = load_network(manifest, use_cuda)
        self._lock = threading.Lock()

    def detect(self, frame: np.ndarray) -> list[Detection]:
        size = self.manifest.input_size
        prepared, transform = letterbox(frame, size)
        blob = cv2.dnn.blobFromImage(prepared, 1 / 255.0, (size, size), swapRB=True, crop=False)
        with self._lock:
            self.network.setInput(blob)
            output = np.squeeze(self.network.forward())
        if output.ndim != 2: raise RuntimeError(f"Unsupported model output shape: {output.shape}")
        expected_features = 4 + len(self.manifest.labels) + (1 if self.manifest.output_format == "yolo_v5" else 0)
        if output.shape[1] == expected_features:
            pass
        elif output.shape[0] == expected_features:
            output = output.T
        else:
            raise RuntimeError(f"Model output does not match {len(self.manifest.labels)} labels: {output.shape}")
        boxes, scores, class_ids = [], [], []
        for row in output:
            objectness = float(row[4]) if self.manifest.output_format == "yolo_v5" else 1.0
            probabilities = row[5:] if self.manifest.output_format == "yolo_v5" else row[4:]
            class_id = int(np.argmax(probabilities))
            score = objectness * float(probabilities[class_id])
            if score < self.threshold or class_id >= len(self.manifest.labels): continue
            label = self.manifest.labels[class_id]
            if label not in self.accepted_labels: continue
            cx, cy, bw, bh = map(float, row[:4])
            boxes.append(list(transform.restore_box(cx, cy, bw, bh)))
            scores.append(score); class_ids.append(class_id)
        keep = []
        for class_id in set(class_ids):
            candidates = [index for index, value in enumerate(class_ids) if value == class_id]
            selected = cv2.dnn.NMSBoxes([boxes[index] for index in candidates], [scores[index] for index in candidates], self.threshold, 0.45)
            keep.extend(candidates[int(index)] for index in np.array(selected).flatten())
        return [Detection(self.manifest.labels[class_ids[index]], scores[index], tuple(boxes[index])) for index in keep]
