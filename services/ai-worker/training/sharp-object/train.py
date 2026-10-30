from __future__ import annotations

import argparse
import json
import os
import random
import time
from pathlib import Path

os.environ.setdefault("YOLO_CONFIG_DIR", str(Path(__file__).resolve().parents[2] / "research" / ".ultralytics"))

import numpy as np
import torch
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    parser = argparse.ArgumentParser(description="Bounded sharp-object YOLO fine-tuning experiment.")
    parser.add_argument("--model", type=Path, default=ROOT / "yolov8n.pt")
    parser.add_argument("--data", type=Path, default=Path(__file__).with_name("pilot-data.yaml"))
    parser.add_argument("--project", type=Path, default=ROOT / "research" / "experiments" / "sharp-object")
    parser.add_argument("--name", default="yolov8n-pilot-cpu")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--imgsz", type=int, default=320)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=20261029)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--freeze", type=int, default=10)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    args.project.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    model = YOLO(str(args.model.resolve()))
    result = model.train(
        data=str(args.data.resolve()),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        workers=args.workers,
        seed=args.seed,
        deterministic=True,
        device=args.device,
        freeze=args.freeze,
        project=str(args.project.resolve()),
        name=args.name,
        exist_ok=False,
        pretrained=True,
        cls_remap=False,
        optimizer="AdamW",
        lr0=0.001,
        cos_lr=True,
        close_mosaic=3,
        plots=True,
        verbose=True,
    )
    run_dir = Path(result.save_dir)
    summary = {
        "model": str(args.model.resolve()),
        "data": str(args.data.resolve()),
        "runDir": str(run_dir),
        "elapsedSeconds": round(time.perf_counter() - started, 3),
        "epochsRequested": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "seed": args.seed,
        "device": args.device,
        "freeze": args.freeze,
    }
    (run_dir / "experiment.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
