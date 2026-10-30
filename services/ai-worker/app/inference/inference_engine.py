from pathlib import Path
import time
from app.detectors.object_detector import YoloOnnxDetector
from app.detectors.specialized import detector_specs
from app.inference.model_loader import load_manifest

class DetectorRegistry:
    def __init__(self, model_dir: Path, use_cuda: bool = False, specs=None):
        self.specs = detector_specs if specs is None else specs
        self.models = {}
        self.kind_models = {}
        self.statuses = []
        self.last_latency_ms = {}
        self.last_errors = {}
        grouped = {}
        for kind, spec in self.specs.items():
            grouped.setdefault(spec.manifest_name, []).append((kind, spec))
        for manifest_name, members in grouped.items():
            try:
                manifest = load_manifest(model_dir / manifest_name)
                required_labels = set().union(*(set(spec.labels) for _, spec in members))
                detector = YoloOnnxDetector(manifest_name, manifest, required_labels, use_cuda=use_cuda)
                self.models[manifest_name] = detector
            except Exception as error:
                detector = None
                load_error = type(error).__name__
            for kind, spec in members:
                if detector:
                    self.kind_models[kind] = manifest_name
                    self.statuses.append({"detectorId": kind.lower(), "type": kind, "state": "READY", "modelId": manifest.model_id, "modelVersion": manifest.version})
                else:
                    self.statuses.append({"detectorId": kind.lower(), "type": kind, "state": "MODEL_UNAVAILABLE", "errorCode": load_error})
        person = self.model_for_kind("PERSON")
        self.statuses.append({"detectorId": "crowd", "type": "CROWD", "state": "READY" if person else "MODEL_UNAVAILABLE", **({"modelId": person.manifest.model_id, "modelVersion": person.manifest.version} if person else {"errorCode": "PERSON_MODEL_UNAVAILABLE"})})

    def model_for_kind(self, kind):
        model_name = self.kind_models.get(kind)
        return self.models.get(model_name) if model_name else None

    def kinds_for_event_type(self, event_type):
        if event_type == "CROWD_GATHERING":
            return ["PERSON"]
        return [name for name, spec in self.specs.items() if spec.event_type == event_type]

    def model_names_for_event_types(self, event_types):
        names = set()
        for event_type in event_types:
            for kind in self.kinds_for_event_type(event_type):
                model_name = self.kind_models.get(kind)
                if model_name:
                    names.add(model_name)
        return names

    def infer_frame(self, frame, event_types=None):
        outputs = {}
        selected = self.models.keys() if event_types is None else self.model_names_for_event_types(event_types)
        for name in selected:
            detector = self.models[name]
            started = time.perf_counter()
            try:
                outputs[name] = detector.detect(frame)
                self.last_errors.pop(name, None)
            except Exception as error:
                outputs[name] = []
                self.last_errors[name] = type(error).__name__
            finally:
                self.last_latency_ms[name] = round((time.perf_counter() - started) * 1000, 2)
        return outputs

    def telemetry_for(self, event_type):
        model_names = {self.kind_models.get(kind) for kind in self.kinds_for_event_type(event_type)} - {None}
        latencies = [self.last_latency_ms[name] for name in model_names if name in self.last_latency_ms]
        errors = [f"{name}:{self.last_errors[name]}" for name in model_names if name in self.last_errors]
        return (round(sum(latencies), 2) if latencies else None), (";".join(errors) if errors else None)

    def detections_for(self, event_type, outputs, crowd_count):
        if event_type == "CROWD_GATHERING":
            model_name = self.kind_models.get("PERSON")
            # Return the real person detections. The caller confidence-filters
            # first and only then applies its configured crowd threshold.
            return [item for item in outputs.get(model_name, []) if item.label == "person"]
        found = []
        for kind in self.kinds_for_event_type(event_type):
            model_name = self.kind_models.get(kind)
            if model_name:
                accepted = self.specs[kind].labels
                found.extend(item for item in outputs.get(model_name, []) if item.label in accepted)
        return found

    def version(self, event_type):
        kinds = self.kinds_for_event_type(event_type)
        detectors = [self.model_for_kind(kind) for kind in kinds]
        detectors = [detector for detector in detectors if detector is not None]
        if not detectors: raise KeyError(event_type)
        versions = "+".join(dict.fromkeys(detector.manifest.version for detector in detectors))
        detector_id = "crowd" if event_type == "CROWD_GATHERING" else kinds[0].lower()
        return detector_id, versions
