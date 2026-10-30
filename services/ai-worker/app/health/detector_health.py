from pathlib import Path
from app.detectors.specialized import detector_specs

def initial_health(model_dir: Path) -> list[dict]:
    result = []
    for kind, spec in detector_specs.items():
        manifest = model_dir / spec.manifest_name
        result.append({"detectorId": kind.lower(), "type": kind, "state": "NOT_CONFIGURED" if manifest.exists() else "MODEL_UNAVAILABLE", "errorCode": None if manifest.exists() else "MODEL_MANIFEST_MISSING"})
    result.append({"detectorId": "crowd", "type": "CROWD", "state": "NOT_CONFIGURED" if (model_dir / "coco.json").exists() else "MODEL_UNAVAILABLE", "errorCode": None if (model_dir / "coco.json").exists() else "PERSON_MODEL_UNAVAILABLE"})
    return result
