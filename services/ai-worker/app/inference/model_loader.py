from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
import cv2

@dataclass(frozen=True)
class ModelManifest:
    model_id: str
    version: str
    file: Path
    labels: tuple[str, ...]
    sha256: str
    input_size: int = 640
    output_format: str = "yolo_v8"

def load_manifest(path: Path) -> ModelManifest:
    data = json.loads(path.read_text(encoding="utf-8"))
    model_file = path.parent / data["file"]
    digest = hashlib.sha256(model_file.read_bytes()).hexdigest()
    if digest.lower() != data["sha256"].lower(): raise ValueError(f"Checksum mismatch for {data['modelId']}")
    output_format = data.get("outputFormat")
    if output_format not in ("yolo_v8", "yolo_v5"):
        raise ValueError("outputFormat must explicitly be yolo_v8 or yolo_v5")
    return ModelManifest(data["modelId"], data["version"], model_file, tuple(data["labels"]), digest, int(data.get("inputSize", 640)), output_format)

def load_network(manifest: ModelManifest, use_cuda: bool = False):
    network = cv2.dnn.readNetFromONNX(str(manifest.file))
    if use_cuda:
        network.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
        network.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA_FP16)
    else:
        network.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        network.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    return network
