from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

import cv2
import numpy as np


BBOX_URL = "https://storage.googleapis.com/openimages/v6/oidv6-train-annotations-bbox.csv"
METADATA_URL = "https://storage.googleapis.com/openimages/2018_04/train/train-images-boxable-with-rotation.csv"
IMAGE_URL = "https://open-images-dataset.s3.amazonaws.com/train/{image_id}.jpg"
SCISSORS_MID = "/m/01lsmm"
ALLOWED_LICENSES = {
    "https://creativecommons.org/licenses/by/2.0/",
    "https://creativecommons.org/licenses/by/3.0/",
    "https://creativecommons.org/licenses/by/4.0/",
    "https://creativecommons.org/publicdomain/zero/1.0/",
}


def csv_stream(url: str):
    response = urllib.request.urlopen(url, timeout=120)
    text = io.TextIOWrapper(response, encoding="utf-8", newline="")
    return response, csv.DictReader(text)


def collect_boxes(limit: int) -> dict[str, list[dict]]:
    selected: dict[str, list[dict]] = {}
    response, rows = csv_stream(BBOX_URL)
    try:
        for row in rows:
            image_id = row["ImageID"]
            if len(selected) >= limit and image_id not in selected:
                break
            if row["LabelName"] == SCISSORS_MID:
                selected.setdefault(image_id, []).append(row)
    finally:
        response.close()
    return selected


def collect_metadata(image_ids: set[str]) -> dict[str, dict]:
    found = {}
    response, rows = csv_stream(METADATA_URL)
    try:
        for row in rows:
            image_id = row["ImageID"]
            if image_id in image_ids and row["License"] in ALLOWED_LICENSES:
                found[image_id] = row
            if len(found) == len(image_ids):
                break
    finally:
        response.close()
    return found


def contact_sheet(output: Path, records: list[dict]) -> None:
    pages = (len(records) + 15) // 16
    for page in range(pages):
        canvas = np.full((4 * 240, 4 * 320, 3), 245, dtype=np.uint8)
        for cell, record in enumerate(records[page * 16:(page + 1) * 16]):
            frame = cv2.imread(str(output / record["image"]))
            height, width = frame.shape[:2]
            for box in record["boxes"]:
                cv2.rectangle(frame, (int(box["xmin"] * width), int(box["ymin"] * height)),
                              (int(box["xmax"] * width), int(box["ymax"] * height)), (0, 220, 0), 2)
            scale = min(320 / width, 210 / height)
            frame = cv2.resize(frame, (int(width * scale), int(height * scale)))
            row, column = divmod(cell, 4)
            x = column * 320 + (320 - frame.shape[1]) // 2
            y = row * 240 + (210 - frame.shape[0]) // 2
            canvas[y:y + frame.shape[0], x:x + frame.shape[1]] = frame
            cv2.putText(canvas, record["imageId"], (column * 320 + 5, row * 240 + 230),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (20, 20, 20), 1, cv2.LINE_AA)
        cv2.imwrite(str(output / f"contact-{page + 1:02d}.jpg"), canvas)


def main(output: Path, candidates: int, keep: int) -> None:
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    boxes = collect_boxes(candidates)
    metadata = collect_metadata(set(boxes))
    output.mkdir(parents=True)
    images = output / "images"
    images.mkdir()
    records = []
    for image_id in sorted(metadata)[:keep]:
        image_path = images / f"{image_id}.jpg"
        urllib.request.urlretrieve(IMAGE_URL.format(image_id=image_id), image_path)
        frame = cv2.imread(str(image_path))
        if frame is None:
            continue
        normalized_boxes = [{
            "xmin": float(row["XMin"]), "xmax": float(row["XMax"]),
            "ymin": float(row["YMin"]), "ymax": float(row["YMax"]),
            "occluded": row["IsOccluded"] == "1", "truncated": row["IsTruncated"] == "1",
        } for row in boxes[image_id]]
        meta = metadata[image_id]
        records.append({
            "imageId": image_id,
            "image": f"images/{image_id}.jpg",
            "sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
            "width": frame.shape[1], "height": frame.shape[0], "boxes": normalized_boxes,
            "license": meta["License"], "author": meta["Author"],
            "authorProfileURL": meta["AuthorProfileURL"],
            "originalURL": meta["OriginalURL"], "originalLandingURL": meta["OriginalLandingURL"],
            "title": meta["Title"], "source": "Open Images train bounding boxes",
        })
    (output / "manifest.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    with (output / "ATTRIBUTION.csv").open("w", encoding="utf-8", newline="") as handle:
        fields = ("imageId", "author", "authorProfileURL", "originalLandingURL", "originalURL", "license", "title")
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    contact_sheet(output, records)
    print(json.dumps({"candidateImages": len(boxes), "licensedMetadata": len(metadata),
                      "downloadedImages": len(records), "scissorsBoxes": sum(len(r["boxes"]) for r in records)}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream a small attributed Open Images train scissors subset.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--candidates", type=int, default=100)
    parser.add_argument("--keep", type=int, default=80)
    args = parser.parse_args()
    main(args.output.resolve(), args.candidates, args.keep)
