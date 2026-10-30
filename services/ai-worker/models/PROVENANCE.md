# Model provenance

## `yolov8n.onnx`

- Purpose: person, vehicle, count-based crowd, knife and scissors proposals.
- Architecture/classes: Ultralytics YOLOv8n, COCO 80 classes.
- Local integrity: pinned by `coco.json` SHA-256.
- License: Ultralytics AGPL-3.0 or a separately purchased Enterprise license. Deployment must comply with the applicable option.

## `fire-smoke-yolov8n-v0.onnx`

- Purpose: visual fire and smoke indicators.
- Source: `fiacecson20/cctv-ai-fire-smoke` on Hugging Face.
- Pinned revision: `343990e42d99a5d27e9f35fc7c80880dc5f43f45`.
- Architecture: YOLOv8n, ONNX opset 12, input `1x3x320x320`, output `1x6x2100`.
- Classes: `fire`, `smoke`.
- Published validation: overall mAP@0.5 0.743; fire precision 0.781, recall 0.893, mAP@0.5 0.912; smoke precision 0.706, recall 0.517, mAP@0.5 0.573.
- Data: author states a CC-BY 4.0 dataset; source images are not redistributed here.
- License: the repository describes the weights as MIT, while embedded ONNX metadata identifies the Ultralytics base as AGPL-3.0. Treat the model as AGPL-3.0 unless an appropriate Ultralytics Enterprise license is obtained.
- Integrity: SHA-256 `f2699b753e78be8d392bfa63e64bf102ea3ceb8b6086a59dfd8192b61a0c6fad`.
- Local verification: loaded by the production OpenCV decoder, produced a fire detection on the publisher's labeled validation contact sheet, and produced no detection on the official Ultralytics bus negative image.
- Limitation: smoke validation contains only 29 instances in the published round-one report. This is an uncertain visual indicator and must not replace certified fire/smoke alarms.

## Unsupported models/classes

- Razor blade and box cutter: no reviewed RGB-CCTV pretrained model with adequate licensing, metrics and local positive/negative verification is installed.
- Smoking activity: cigarette or smoke-object presence is insufficient to prove a person is smoking; no activity model is installed.
# Sharp knife v4

- File: `sharp-knife-v4.onnx`
- Manifest: `sharp-knife.json`
- SHA-256: `fb289c5d99af115dc8659b4f353329656b87e637fc7d06f0f90a3aa5a760cff8`
- Base checkpoint: existing local YOLOv8n COCO checkpoint.
- Fine-tuning data: attributed Open Images knife positives, 80 additional attributed Open Images train scissors negatives, and the reviewed difficult-negative set under `research/datasets/knife-training-v3`.
- Training configuration: clean one-class head (`cls_remap=False`), CPU, 4 epochs, 320 px, batch 16, seed 20261029.
- Verified through the production OpenCV DNN registry path at confidence 0.50: knife video 12/50 positive samples with five consecutive positives; scissors video 0/16 false knife samples; crowd video 0/25 false knife samples.
- Supported class: `knife` only. Utility cutter and razor blade remain unsupported.

