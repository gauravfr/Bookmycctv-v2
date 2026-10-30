# AI detection reliability audit — 2026-10-29

Scope: RGB CCTV inference only. Frontend, mobile, Docker and notifications were intentionally excluded. Published metrics below describe publishers' datasets and are not treated as BookMyCCTV accuracy.

## 1. Installed model inventory

| Model | Local format / size | Input | Enabled classes | Licence status | Local evidence |
|---|---:|---:|---|---|---|
| Ultralytics YOLOv8n COCO | ONNX / 12,824,061 bytes | 640 | person, car, bus, truck, motorcycle, knife, scissors | AGPL-3.0 or Ultralytics Enterprise | scissors, person and crowd positive; knife positive missed; bus and crowd sharp negatives clean |
| `fiacecson20/cctv-ai-fire-smoke` | ONNX opset 12 / 12,139,911 bytes | 320 | fire, smoke | publisher says MIT, but embedded Ultralytics derivative metadata means treat as AGPL-3.0/Enterprise | fire positive sheet detected; smoke on same sheet missed; bus negatives clean |

Both manifests are checksum pinned. Razor blade, box cutter/paper cutter, and smoking activity are not enabled.

## 2. Candidate comparison

| Candidate/source | Exact useful classes | Format/input | Publisher evidence | Licence/commercial issue | Decision |
|---|---|---|---|---|---|
| Existing YOLOv8n COCO ([official model documentation](https://docs.ultralytics.com/models/yolov8), [COCO](https://cocodataset.org/)) | knife, scissors, person and vehicles; no razor or cutter class | installed ONNX, 640 | Official aggregate COCO AP is not class/CCTV proof | [Ultralytics licensing](https://www.ultralytics.com/license): AGPL-3.0 or Enterprise for proprietary deployment | Keep current integration; scissors verified, knife remains unverified |
| Google Open Images V7 ([official facts](https://storage.googleapis.com/openimages/web/factsfigures_v7.html)) with an Open-Images detector | Kitchen knife, Paper cutter, Scissors; no specific razor-blade class confirmed | Dataset; candidate pretrained deployment formats vary | Large professionally boxed dataset, but no candidate-specific CCTV result | Image licences/attribution and exact checkpoint licence must be audited; NVIDIA TAO weights also have NGC terms | Best dataset lead for knife/cutter fine-tuning; no reviewed drop-in ONNX found |
| NVIDIA TAO Open Images pretrained detector ([documentation](https://docs.nvidia.com/tao/tao-toolkit-archive/tao-40/text/model_zoo/cv_models/open_images/open_images_pt_object_detection.html)) | Open Images label space | TAO checkpoint, not current decoder's ONNX contract | No local test performed | NGC/TAO model terms require legal review; conversion and decoder compatibility required | Research lead, not integrated |
| Official Baidu RT-DETR/RT-DETRv2 ([repository](https://github.com/lyuwenyu/RT-DETR), [CVPR paper](https://arxiv.org/abs/2304.08069)) | COCO classes including knife/scissors/person, not razor/cutter | official Paddle/PyTorch; 640; R18 has 20M parameters | R18 COCO AP 46.5 is aggregate, not CCTV or sharp-class proof | Apache-2.0 repository; verify each checkpoint/data lineage | Licensing alternative for person/COCO research, but heavier and incompatible with current YOLO decoder; not integrated without labelled comparison |
| OPIXray knife models | folding/straight/utility/multi-tool knife, scissors | commonly YOLO weights | Airport baggage X-ray domain | varies | Rejected: X-ray appearance is not ordinary RGB CCTV |
| Existing fire/smoke ONNX ([model card/files](https://huggingface.co/fiacecson20/cctv-ai-fire-smoke/tree/main)) | fire, smoke | ONNX, 320 | publisher reports mAP@0.5 0.743 overall; smoke recall 0.517 and only 29 published smoke instances in the audited round | Treat as Ultralytics AGPL-3.0/Enterprise despite MIT model-card tag | Retain as visual indicator, not certified alarm; smoke needs substantially more testing |
| Supakorn fire/smoke R3E6 ([repository](https://github.com/Supakorn289/fire-smoke-detection-r3e6)) | Fire, Smoke | downloadable YOLOv8s ONNX, 768, about 42.7 MiB | unusually detailed locked-test and hard-negative documentation | repository explicitly has no repository-wide licence | Technically promising but not deployable until licence clarified; not downloaded/integrated |
| `alihassanml/Smoking-detection-yolo11` ([repository](https://github.com/alihassanml/Smoking-detection-yolo11)) | one declared `smoking` class | tested ONNX, 640, 12,250,957 bytes | no dataset, split, precision/recall or mAP published | repo says MIT; YOLO11 derivative remains subject to Ultralytics licensing according to Ultralytics | Tested in quarantine; only 1/3 publisher examples detected; not enabled |
| Object-only cigarette/smoke models | cigarette, cigar or smoke | varies | object presence is not proof of the hand-to-mouth smoking activity | varies | Cannot satisfy `SMOKING_ACTIVITY` alone; rejected as direct replacement |

## 3. Reproducible observed results

All detections used the production `DetectorRegistry`, checksum loader, OpenCV-DNN decoder, preprocessing and NMS at confidence 0.50. No threshold was lowered to produce a detection.

| Test | Frames analysed | Positive frames / observations | Result |
|---|---:|---:|---|
| licensed scissors video | 16 | 4 | scissors only; max confidence 0.7081; no knife relabelling |
| existing scissors image | 1 | 1 | two scissors boxes; max confidence 0.9292 |
| existing knife image | 1 | 0 | missed; knife cannot be called verified |
| crowd-room negative for sharp | 25 | 0 | no sharp false positive |
| bus negative for sharp | 1 | 0 | no sharp false positive |
| licensed crowd-room video | 25 | 25 | max 12 people; 221 person boxes; max confidence 0.9099; 3-second persistence accepted |
| scissors-video crowd negative | 16 | 0 | no crowd condition |
| 305-frame person stability run | 61 sampled | 61 | four persons per sampled frame; no inference error; 244 boxes total |
| fire/smoke publisher validation contact sheet, fire rule | 1 | 1 | one fire, confidence 0.5339 |
| same sheet, smoke rule | 1 | 0 | smoke missed at the unchanged 0.50 threshold |
| bus fire/smoke negative | 1 each | 0 | no fire/smoke false positive |
| crowd video fire/smoke negatives | 25 each | 0 | no fire/smoke false positive |
| scissors video fire/smoke negatives | 16 each | 0 | no fire/smoke false positive |
| quarantined smoking candidate publisher examples | 3 | 1 | only `output2.jpg`, confidence 0.5467 |
| quarantined smoking candidate bus negative | 1 | 0 | clean negative, but insufficient validation |

This media set is not a statistically representative labelled benchmark, so precision/recall are intentionally not claimed.

## 4. CPU and memory observations

Measured on this Windows host with OpenCV-DNN CPU. These are end-to-end model calls in one run, not portable hardware guarantees.

| Workload | Mean / p95 inference | Effective model FPS | Peak process working set |
|---|---:|---:|---:|
| scissors video, selective COCO inference | 365.50 / 602.61 ms | 2.74 | 242.2 MiB |
| crowd video, selective COCO inference | 765.06 / 945.27 ms | 1.31 | 249.6 MiB |
| 305-frame stability video, 61 COCO samples | 552.83 / 740.50 ms | 1.81 | 179.1 MiB |
| fire positive, selective 320 model | 160.28 ms | 6.24 | 128.0 MiB |
| fire crowd-negative video, warm 320 model | 88.32 / 113.71 ms | 11.32 | 195.0 MiB |
| smoke crowd-negative video, warm 320 model | 102.87 / 140.94 ms | 9.72 | 195.2 MiB |
| smoking research model | 381–441 ms | 2.27–2.62 | 149.9–164.7 MiB |

Runtime variation includes image resolution, cold starts and host load. The camera sampler should remain around 1–2 FPS on this CPU rather than trying to infer every video frame.

## 5. Reliability improvements made

- The existing registry now selects only model files required by active camera rules. Multiple active rules that share a manifest still reuse one inference result.
- A no-movement-only camera now performs motion analysis without unnecessarily running object detectors.
- The existing video evaluator now records observed labels, mean/p95 inference time, effective FPS and peak working set when `psutil` is available.
- Smoking candidate files are isolated under `research/candidates`; no production manifest was installed.

## 6. Supported status after audit

- **Verified in current evidence:** scissors, person detection, count-based crowd and 300-second inactivity.
- **Enabled but insufficiently verified:** COCO knife; fire visual indicator.
- **Enabled model class but currently weak evidence:** smoke visual indicator (positive sheet missed and publisher's smoke recall is weak).
- **Unsupported/disabled:** razor blade, box cutter/utility knife, smoking activity.

## 7. No-movement reliability

The single existing `MotionAnalyzer` was retained. Tests cover a real elapsed 300-second trigger, movement reset, global lighting change suppression, cooldown, and exact repeated-frame frozen-feed rejection. The controlled 305-second encoded video completed in 301.001 wall-clock seconds, triggered at 300.987 seconds and was not classified frozen. Camera disconnect/stream failure yields no valid frames and therefore cannot create an inactivity event.

## 8. Recommended next implementation

1. Build a camera-domain labelled test set before replacing models: video-level train/validation/test separation, at least 200–300 independently sourced positive instances per sharp class for initial feasibility, 300+ hard negatives, and distance/angle/day/night/occlusion strata. This is an evaluation floor, not enough for production training.
2. If fine-tuning is approved, target roughly 1,000–2,000 diverse labelled instances each for knife, scissors and utility/box cutter, plus at least 500 razor instances and 2,000 hard negatives. Prefer permissively licensed RT-DETR/RF-DETR-style training code and verify pretrained-weight/data licences. Keep a separate locked CCTV test set.
3. For smoking, use a multi-stage design only after dataset approval: person/hand region, cigarette/smoke cues, pose/hand-to-mouth temporal sequence and multi-frame confirmation. Train/evaluate at activity-track level, not single-object presence.
4. Expand fire/smoke tests with licensed real CCTV clips and hard negatives: sunset, orange clothing, welding, steam, fog, clouds, headlights and compression artifacts. Do not promote smoke until recall and false-alarm rates are measured on a locked set.
5. Calibrate per-class thresholds from precision-recall curves on that locked local set; do not globally lower 0.50 to obtain demos.

