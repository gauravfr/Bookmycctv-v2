# Sharp-object pretrained model comparison — 2026-10-29

Production baseline was preserved. All candidates stayed under `services/ai-worker/research/candidates` and were evaluated through the existing checksum loader, `YoloOnnxDetector`, preprocessing, NMS and annotation workflow.

## Consistent evaluation media

- Knife image already present in the repository.
- Scissors image already present in the repository.
- Pexels 6811286 real RGB knife/food-preparation video: 24 seconds, 590 frames, evaluated at 2 sampled FPS (50 samples).
- Existing licensed scissors video: 16 samples at 2 FPS.
- Existing crowded-room video: 25 negative samples.
- Official Ultralytics bus image: one negative sample.

This set is reproducible but not large or independently box-labelled enough for precision/recall claims. “Positive frame rate” below means observed sampled frames, not statistical recall.

## Models

| Model | Source/licence | Actual classes | Input | Commercial CCTV suitability before results |
|---|---|---|---:|---|
| Production YOLOv8n COCO | [Ultralytics YOLOv8](https://docs.ultralytics.com/models/yolov8); AGPL-3.0 or Enterprise | COCO 80, including knife and scissors; no cutter/razor | static 640 | only with AGPL compliance or Enterprise licence |
| Hadi959 weapon YOLOv8 | [Hugging Face](https://huggingface.co/Hadi959/weapon-detection-yolov8); no declared licence | pistol, knife | static 640 | no: missing licence, dataset provenance and metrics |
| ECE T1 weapon FP32 | [Hugging Face](https://huggingface.co/ECE-Software/connect-t1-weapon-fp32); model card declares Apache-2.0 | gun, explosion, grenade, knife | static 640 | licence is more promising, but dataset/benchmark provenance remains undocumented |

No candidate claims scissors, razor blade, box cutter or utility knife. Those classes were not added.

## Results at confidence 0.50

| Measurement | COCO baseline | Hadi959 | ECE T1 |
|---|---:|---:|---:|
| Knife image | miss | **1 at 0.8630** | miss |
| Knife video positive frames | 1/50 (2%) | **3/50 (6%)** | 2/50 (4%) |
| Knife-video max confidence | 0.5804 | **0.7928** | 0.6815 |
| Knife-video max consecutive positives | 1 | **2** | 1 |
| Scissors video behaviour | 4/16 correctly `scissors` | **12/16 falsely `knife`** | **4/16 falsely `knife`** |
| Crowd negative | 0/25 | 0/25 | 0/25 |
| Bus negative | 0/1 | 0/1 | 0/1 |
| Mean/p95 CPU latency, comparable knife run | **443.46/549.38 ms** | 463.72/601.47 ms | 485.57/741.49 ms |
| Peak working set | 202.6 MiB | **185.2 MiB** | **183.1 MiB** |

The specialized candidates produce slightly more knife frames, but both confuse real scissors with knives. Hadi959 is especially unsafe: the scissors false detections are more frequent and more temporally consistent than its correct knife detections.

## Confidence calibration

Number of positive sampled frames at each threshold:

| Clip/model | 0.50 | 0.60 | 0.70 | 0.80 |
|---|---:|---:|---:|---:|
| Baseline knife | 1 | 0 | 0 | 0 |
| Baseline scissors (correct class) | 4 | 4 | 2 | 0 |
| Hadi knife | 3 | 3 | 2 | 0 |
| Hadi scissors→knife false | 12 | 12 | 4 | 4 |
| ECE knife | 2 | 1 | 0 | 0 |
| ECE scissors→knife false | 4 | 0 | 0 | 0 |

- Hadi cannot be repaired by threshold calibration: at 0.80 it retains four scissors-as-knife false frames and zero knife positives.
- ECE at 0.60 removes observed scissors false positives, but retains only one knife frame, so it does not meaningfully outperform the baseline.
- Per-class calibration needs a much larger labelled set; these counts are insufficient to choose a production threshold.

## Temporal consistency and false-alarm handling

The current production temporal filter requires three consecutive positive samples. On the knife video, baseline/Hadi/ECE reached only 1/2/1 consecutive positives, so none would yield a reliable knife event. Hadi reached three consecutive **false** knife detections on the scissors clip, so the temporal filter would not rescue that candidate. No temporal-rule change was made from this small set.

## Higher resolution and small-object experiment

The installed ONNX exports have static 640×640 detection-head reshape dimensions. Research-only attempts to feed 960×960 failed safely in OpenCV-DNN at the fixed detection-head reshape; no false result was reported as a miss. Testing 960/1280 requires a dynamic or natively high-resolution re-export from original weights. That conversion is not justified for Hadi because its licence is absent and its scissors confusion is already disqualifying. The ECE repository does not provide source weights/export provenance.

Crop/tiling was not added to production. It multiplies CPU inference and can duplicate boxes/false positives; a labelled small-object set is required before deciding whether that trade-off helps.

## Decision

Neither candidate was integrated.

- Hadi959: stronger isolated knife detections, but unacceptable scissors-as-knife behaviour and no deployable licence.
- ECE T1: slight knife improvement at 0.50, but scissors confusion; calibration that removes the confusion also removes the improvement.
- Existing COCO model remains production baseline because it correctly preserves knife versus scissors semantics and provides the verified scissors path, despite weak knife consistency.

## Minimal fine-tuning proposal — approval required before execution

### Dataset

Phase A feasibility set, with video-level separation to prevent frame leakage:

- 400–600 RGB knife instances.
- 300–500 scissors instances.
- 300–500 utility/box-cutter instances.
- Razor blade remains a separate feasibility class only if at least 300 clear RGB instances can be legally collected.
- 1,000–1,500 hard-negative frames: phones, pens, cutlery, rulers, keys, tools, scissors-as-knife confusion, reflective edges and empty hands.
- At least 20% of positives should be small/occluded/distant; include day/night and low-bitrate CCTV degradation.

Potential sources:

- Controlled original recordings with multiple cameras, distances, lighting and backgrounds; strongest licensing and domain match.
- [Google Open Images V7](https://storage.googleapis.com/openimages/web/factsfigures_v7.html) subsets for Kitchen knife, Paper cutter and Scissors, after preserving per-image licence/attribution and auditing annotation policy.
- Existing licensed Pexels/Pixabay clips for evaluation or supplemental frames, subject to source-level provenance and avoiding near-duplicate frames.

Do not use OPIXray or other X-ray imagery.

### Annotation effort

- Expected 2,000–3,500 positive boxes plus 1,000–1,500 verified negative frames.
- Roughly 45–80 hours initial bounding-box work and 15–30 hours independent QA, depending on pre-labelling quality and occlusion complexity.
- Use CVAT with exact class policy; ambiguous multi-tools and closed cutters must be explicitly marked ignore rather than forced into a class.

### Training/compute

- Prefer a permissively licensed RT-DETRv2-R18 or similarly small Apache-2.0 detector after confirming checkpoint/data rights.
- Initial feasibility: one 16–24 GB GPU, approximately 8–20 GPU-hours across baseline plus one controlled augmentation run.
- Input 768 or 960 with small-object augmentations, then export ONNX and benchmark OpenCV/ONNX Runtime CPU.
- Locked test set must never be used for threshold selection.

### Acceptance gate

- Per-class precision/recall and PR curves on the locked test set.
- Video-level detection consistency and false alerts per hour.
- Dedicated scissors-versus-knife confusion matrix.
- CPU p95 compatible with the 1–2 FPS camera sampler.
- No class enabled unless it has positive video evidence and acceptable hard-negative behaviour.

### Expected limitations

Very small blades, heavy occlusion, motion blur, hands covering the handle, low-light glare and visually similar tools will remain difficult. RGB detection cannot establish intent or threat, and the result remains an uncertain visual indicator rather than a certified safety system.

