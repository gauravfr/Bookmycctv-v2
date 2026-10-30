from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.events.annotator import annotate
from app.tracking.motion_analyzer import MotionAnalyzer


def run(source: Path, output_dir: Path, required_seconds: float):
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {source}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 1.0
    analyzer = MotionAnalyzer()
    started = time.monotonic()
    frame_index = 0
    trigger = None
    last_state = None
    output_dir.mkdir(parents=True, exist_ok=True)
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        due = started + frame_index / fps
        remaining = due - time.monotonic()
        if remaining > 0:
            time.sleep(remaining)
        now = time.monotonic()
        last_state = analyzer.update(frame, now)
        if frame_index and frame_index % round(fps * 60) == 0:
            print(f"progress elapsed={now - started:.1f}s inactivity={last_state.inactivity_seconds:.1f}s frozen={last_state.frozen}", flush=True)
        if analyzer.should_emit(last_state, required_seconds, 300, now):
            trigger = now
            evidence = annotate(frame, [], f"NO MOVEMENT {last_state.inactivity_seconds:.0f}s")
            if not cv2.imwrite(str(output_dir / "no-movement-evidence.jpg"), evidence):
                raise RuntimeError("Could not write no-movement evidence")
            break
        frame_index += 1
    capture.release()
    summary = {
        "source": str(source.resolve()),
        "requiredSeconds": required_seconds,
        "wallClockElapsedSeconds": round((trigger or time.monotonic()) - started, 3),
        "inactivitySeconds": round(last_state.inactivity_seconds, 3) if last_state else None,
        "frozen": last_state.frozen if last_state else None,
        "changedPixelRatio": round(last_state.changed_ratio, 6) if last_state else None,
        "triggered": trigger is not None,
        "framesRead": frame_index + 1,
    }
    (output_dir / "no-movement-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)
    if trigger is None:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--required-seconds", type=float, default=300)
    args = parser.parse_args()
    run(args.source, args.output_dir, args.required_seconds)
