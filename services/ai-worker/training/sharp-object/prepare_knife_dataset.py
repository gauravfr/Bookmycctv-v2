from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np


def augmented(frame: np.ndarray, variant: int) -> np.ndarray:
    mode = variant % 5
    if mode == 0:
        return cv2.flip(frame, 1)
    if mode == 1:
        return cv2.convertScaleAbs(frame, alpha=0.85, beta=-8)
    if mode == 2:
        return cv2.convertScaleAbs(frame, alpha=1.12, beta=8)
    if mode == 3:
        return cv2.GaussianBlur(frame, (5, 5), 0)
    height, width = frame.shape[:2]
    resized = cv2.resize(frame, (max(1, int(width * 0.9)), max(1, int(height * 0.9))))
    canvas = np.zeros_like(frame)
    y = (height - resized.shape[0]) // 2
    x = (width - resized.shape[1]) // 2
    canvas[y:y + resized.shape[0], x:x + resized.shape[1]] = resized
    return canvas


def main(source: Path, output: Path, scissors_augment: int, extra_scissors: Path | None) -> None:
    records = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite existing dataset: {output}")
    output.mkdir(parents=True)
    counts = {"knifePositive": 0, "scissorsNegative": 0, "otherNegative": 0,
              "augmentedTrainScissorsNegatives": 0, "extraTrainScissorsNegatives": 0}
    for record in records:
        split = record["split"]
        image_id = record["imageId"]
        image_target = output / "images" / split / f"{image_id}.jpg"
        label_target = output / "labels" / split / f"{image_id}.txt"
        image_target.parent.mkdir(parents=True, exist_ok=True)
        label_target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / record["image"], image_target)
        knife_lines = []
        for box in record["targetBoxes"]:
            if box["class"] != "knife":
                continue
            x = (box["xmin"] + box["xmax"]) / 2
            y = (box["ymin"] + box["ymax"]) / 2
            width = box["xmax"] - box["xmin"]
            height = box["ymax"] - box["ymin"]
            knife_lines.append(f"0 {x:.8f} {y:.8f} {width:.8f} {height:.8f}")
        label_target.write_text("\n".join(knife_lines) + ("\n" if knife_lines else ""), encoding="utf-8")
        if knife_lines:
            counts["knifePositive"] += 1
        elif record["selectionClass"] == "scissors":
            counts["scissorsNegative"] += 1
            if split == "train" and scissors_augment:
                frame = cv2.imread(str(image_target))
                if frame is None:
                    raise RuntimeError(f"Cannot read {image_target}")
                for variant in range(scissors_augment):
                    stem = f"{image_id}-scissors-neg-{variant:02d}"
                    cv2.imwrite(str(image_target.with_name(stem + ".jpg")), augmented(frame, variant),
                                [cv2.IMWRITE_JPEG_QUALITY, 92])
                    label_target.with_name(stem + ".txt").write_text("", encoding="utf-8")
                    counts["augmentedTrainScissorsNegatives"] += 1
        else:
            counts["otherNegative"] += 1
    if extra_scissors is not None:
        extra_records = json.loads((extra_scissors / "manifest.json").read_text(encoding="utf-8"))
        for record in extra_records:
            stem = f"oi-train-{record['imageId']}"
            shutil.copy2(extra_scissors / record["image"], output / "images" / "train" / f"{stem}.jpg")
            (output / "labels" / "train" / f"{stem}.txt").write_text("", encoding="utf-8")
            counts["extraTrainScissorsNegatives"] += 1
    (output / "data.yaml").write_text(
        f"path: {output.resolve().as_posix()}\ntrain: images/train\nval: images/validation\ntest: images/test\n"
        "names:\n  0: knife\n",
        encoding="utf-8",
    )
    (output / "source-manifest.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    (output / "dataset-summary.json").write_text(json.dumps(counts, indent=2), encoding="utf-8")
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Materialize a one-class knife set with scissors as hard negatives.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--scissors-augment", type=int, default=0)
    parser.add_argument("--extra-scissors", type=Path)
    args = parser.parse_args()
    main(args.source.resolve(), args.output.resolve(), args.scissors_augment,
         args.extra_scissors.resolve() if args.extra_scissors else None)
