from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time
import statistics
from dataclasses import replace

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.events.annotator import annotate
from app.inference.inference_engine import DetectorRegistry
from app.detectors.specialized import DetectorSpec
from app.tracking.temporal_filter import TemporalFilter


EVENTS = {
    "sharp": "SHARP_OBJECT_DETECTED",
    "crowd": "CROWD_GATHERING",
    "person": "PERSON_DETECTED",
    "vehicle": "VEHICLE_DETECTED",
    "fire": "FIRE_VISUAL_INDICATOR",
    "smoke": "SMOKE_VISUAL_INDICATOR",
    "smoking": "SMOKING_ACTIVITY",
}


def working_set_mb() -> float | None:
    try:
        import psutil

        return psutil.Process().memory_info().rss / (1024 * 1024)
    except ImportError:
        return None


def run(source: Path, output: Path, mode: str, model_dir: Path, confidence: float, crowd_count: int, analysis_fps: float, persistence_seconds: float, research_manifest: str | None = None, research_labels: str | None = None, input_size: int | None = None):
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {source}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    output.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(output), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Cannot create video: {output}")
    specs = None
    if research_manifest:
        if mode != "sharp" or not research_labels:
            raise ValueError("Research manifests require --mode sharp and --research-labels")
        labels = frozenset(label.strip() for label in research_labels.split(",") if label.strip())
        specs = {"SHARP_OBJECT": DetectorSpec(EVENTS[mode], research_manifest, labels)}
    registry = DetectorRegistry(model_dir, specs=specs)
    if input_size:
        for detector in registry.models.values():
            detector.manifest = replace(detector.manifest, input_size=input_size)
    temporal_filter = TemporalFilter()
    event_type = EVENTS[mode]
    sample_every = max(1, round(fps / analysis_fps))
    latest = []
    analyzed = positive = max_count = 0
    confidence_values = []
    inference_times_ms = []
    sample_max_confidences = []
    observed_labels: dict[str, int] = {}
    positive_sample_indices = []
    positive_streak = max_positive_streak = 0
    persistent_condition_accepted = False
    peak_working_set_mb = working_set_mb()
    started = time.perf_counter()
    frame_index = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % sample_every == 0:
                inference_started = time.perf_counter()
                outputs = registry.infer_frame(frame, {event_type})
                inference_times_ms.append((time.perf_counter() - inference_started) * 1000)
                latest = [
                    item
                    for item in registry.detections_for(event_type, outputs, crowd_count)
                    if item.confidence >= confidence
                ]
                analyzed += 1
                if latest:
                    positive += 1
                    positive_sample_indices.append(analyzed - 1)
                    positive_streak += 1
                    max_positive_streak = max(max_positive_streak, positive_streak)
                    confidence_values.extend(item.confidence for item in latest)
                    for item in latest:
                        observed_labels[item.label] = observed_labels.get(item.label, 0) + 1
                else:
                    positive_streak = 0
                max_count = max(max_count, len(latest))
                sample_max_confidences.append(max((item.confidence for item in latest), default=0.0))
                if mode == "crowd" and temporal_filter.accept(
                    "demo:crowd",
                    len(latest) >= crowd_count,
                    cooldown_seconds=60,
                    persistence_seconds=persistence_seconds,
                ):
                    persistent_condition_accepted = True
                current_working_set = working_set_mb()
                if current_working_set is not None:
                    peak_working_set_mb = max(peak_working_set_mb or 0, current_working_set)
            title = mode.replace("_", " ").upper()
            writer.write(annotate(frame, latest, title, len(latest) if mode == "crowd" else None))
            frame_index += 1
    finally:
        capture.release()
        writer.release()
    summary = {
        "source": str(source.resolve()),
        "output": str(output.resolve()),
        "mode": mode,
        "eventType": event_type,
        "sourceFrames": total_frames,
        "processedFrames": frame_index,
        "analyzedFrames": analyzed,
        "positiveAnalyzedFrames": positive,
        "positiveFrameRate": round(positive / analyzed, 4) if analyzed else None,
        "positiveSampleIndices": positive_sample_indices,
        "maxConsecutivePositiveSamples": max_positive_streak,
        "confidenceSweep": {
            f"{candidate:.2f}": sum(value >= candidate for value in sample_max_confidences)
            for candidate in (0.50, 0.60, 0.70, 0.80)
        },
        "maxDetectionCount": max_count,
        "maxConfidence": round(max(confidence_values), 4) if confidence_values else None,
        "observedLabels": observed_labels,
        "threshold": confidence,
        "inputSize": input_size or next(iter(registry.models.values())).manifest.input_size,
        "crowdThreshold": crowd_count if mode == "crowd" else None,
        "persistenceSeconds": persistence_seconds if mode == "crowd" else None,
        "persistentConditionAccepted": persistent_condition_accepted if mode == "crowd" else None,
        "elapsedSeconds": round(time.perf_counter() - started, 2),
        "meanInferenceMs": round(statistics.mean(inference_times_ms), 2) if inference_times_ms else None,
        "p95InferenceMs": round(sorted(inference_times_ms)[max(0, int(len(inference_times_ms) * 0.95) - 1)], 2) if inference_times_ms else None,
        "effectiveInferenceFps": round(1000 / statistics.mean(inference_times_ms), 2) if inference_times_ms else None,
        "peakWorkingSetMb": round(peak_working_set_mb, 1) if peak_working_set_mb is not None else None,
        "modelErrors": registry.last_errors,
    }
    summary_path = output.with_suffix(".json")
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the production detector registry over an authorized demo video.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=EVENTS, required=True)
    parser.add_argument("--model-dir", type=Path, default=Path(__file__).resolve().parents[1] / "models")
    parser.add_argument("--confidence", type=float, default=0.5)
    parser.add_argument("--crowd-count", type=int, default=3)
    parser.add_argument("--analysis-fps", type=float, default=2)
    parser.add_argument("--persistence-seconds", type=float, default=3)
    parser.add_argument("--research-manifest", help="Research-only manifest filename; never installs or enables the model")
    parser.add_argument("--research-labels", help="Comma-separated exact labels to evaluate from a research model")
    parser.add_argument("--input-size", type=int, choices=(320, 480, 640, 768, 960, 1280), help="Research-only preprocessing resolution override")
    args = parser.parse_args()
    run(args.source, args.output, args.mode, args.model_dir, args.confidence, args.crowd_count, args.analysis_fps, args.persistence_seconds, args.research_manifest, args.research_labels, args.input_size)
