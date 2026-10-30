from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from collections import Counter
from pathlib import Path

os.environ.setdefault("YOLO_CONFIG_DIR", str(Path(__file__).resolve().parents[2] / "research" / ".ultralytics"))

import cv2
from ultralytics import YOLO


def evaluate_video(model: YOLO, path: Path, expected: str | None, confidence: float, stride: int,
                   evidence_dir: Path) -> dict:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    sampled = positive = correct = confused = consecutive = max_consecutive = 0
    latencies = []
    class_counts: Counter[str] = Counter()
    writer = None
    evidence_dir.mkdir(parents=True, exist_ok=True)
    evidence_path = evidence_dir / f"{path.stem}-conf{confidence:.2f}.mp4"
    frame_index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if frame_index % stride:
            frame_index += 1
            continue
        started = time.perf_counter()
        result = model.predict(frame, imgsz=640, conf=confidence, device="cpu", verbose=False)[0]
        latencies.append((time.perf_counter() - started) * 1000)
        labels = [model.names[int(index)] for index in result.boxes.cls.tolist()]
        class_counts.update(labels)
        sampled += 1
        positive += bool(labels)
        consecutive = consecutive + 1 if labels else 0
        max_consecutive = max(max_consecutive, consecutive)
        correct += bool(expected and expected in labels)
        confused += bool(expected and any(label != expected for label in labels))
        plotted = result.plot()
        if writer is None:
            height, width = plotted.shape[:2]
            source_fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
            writer = cv2.VideoWriter(str(evidence_path), cv2.VideoWriter_fourcc(*"mp4v"),
                                     max(1.0, source_fps / stride), (width, height))
        writer.write(plotted)
        frame_index += 1
    capture.release()
    if writer is not None:
        writer.release()
    return {
        "video": str(path.resolve()),
        "expected": expected,
        "sampledFrames": sampled,
        "positiveFrames": positive,
        "maxConsecutivePositiveFrames": max_consecutive,
        "falsePositiveFrames": positive if expected is None else 0,
        "correctFrames": correct,
        "confusedFrames": confused,
        "detectionsByClass": dict(class_counts),
        "meanLatencyMs": round(statistics.mean(latencies), 2) if latencies else None,
        "p95LatencyMs": round(sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)], 2) if latencies else None,
        "evidenceVideo": str(evidence_path.resolve()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a research sharp-object checkpoint on held-out data and videos.")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=Path(__file__).with_name("pilot-data.yaml"))
    parser.add_argument("--video", action="append", default=[], help="PATH=expected-class; expected may be empty for negatives")
    parser.add_argument("--confidence", type=float, default=0.35)
    parser.add_argument("--stride", type=int, default=15)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--skip-test", action="store_true")
    args = parser.parse_args()

    model = YOLO(str(args.model.resolve()))
    report = {
        "model": str(args.model.resolve()),
        "confidence": args.confidence,
        "testMetrics": None,
        "videos": [],
    }
    if not args.skip_test:
        validation = model.val(data=str(args.data.resolve()), split="test", imgsz=640, conf=args.confidence,
                               device="cpu", workers=0, plots=True, project=str(args.output.parent.resolve()),
                               name=args.output.stem + "-test", exist_ok=True, verbose=False)
        report["testMetrics"] = {
            "precision": float(validation.box.mp),
            "recall": float(validation.box.mr),
            "map50": float(validation.box.map50),
            "map50_95": float(validation.box.map),
            "perClassMap50_95": {model.names[index]: float(value) for index, value in enumerate(validation.box.maps)},
        }
    for item in args.video:
        raw_path, separator, expected = item.partition("=")
        if not separator:
            raise ValueError("--video must be PATH=expected-class (empty class means negative)")
        report["videos"].append(evaluate_video(model, Path(raw_path), expected or None, args.confidence, args.stride,
                                                args.output.parent / "evidence"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
