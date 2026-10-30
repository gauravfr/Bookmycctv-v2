# Sharp-object dataset feasibility — 2026-10-29

## Decision

The limited preparation phase is complete. A small reproducible pilot proves that legally traceable knife/scissors data can be assembled, but it is **not adequate for training or production CCTV claims**. No GPU training was started and no production ONNX model was changed.

## Reproducible pilot evidence

Location: `services/ai-worker/research/datasets/sharp-pilot-v1/pilot-ccby-v1`

| Item | Exact result |
|---|---:|
| Total images | 57 |
| Train / validation / test | 34 / 11 / 12 |
| Positive / hard-negative images | 37 / 20 |
| Knife images / boxes | 30 / 54 |
| Scissors images / boxes | 7 / 7 |
| Utility-knife/box-cutter images / boxes | 0 / 0 |
| Razor-blade images / boxes | 0 / 0 |
| Exact duplicate groups | 0 |
| dHash near-duplicate pairs (distance <=5) | 0 |
| Minimum image dimensions | 547 x 467 |
| Median blur variance | 337.07 |
| Images with blur variance below 50 | 8 |
| Median target box area | 26.8965% of image |
| Target boxes below 1% of image | 0 |

All 57 selected images declare CC BY 2.0. The manifest preserves image URL, landing URL, author/profile, title, licence, original MD5, local SHA-256, split, annotations and quality fields. `ATTRIBUTION.csv` is the human-readable attribution export.

The source-level split key is the original image landing URL. Thus the same source cannot cross train/validation/test. Selection is deterministic. The audit found 52 distinct author profile URLs and no exact or close dHash duplicates.

### Class balance and annotation completeness

The target-box ratio is 54 knife to 7 scissors (7.7:1). Utility knife and razor blade are absent. Only one target box is marked occluded, ten are truncated, one is a group, and none is a depiction. The set therefore underrepresents small, distant, occluded, low-light and surveillance-view objects.

Visual review exposed a material Open Images limitation: the first broad `Kitchen utensil` negative selection included two images with visible but unlabelled knives. That entire negative category was removed, the set was rebuilt, and all final 20 negatives (pen, ruler, phone, fork, spoon) passed contact-sheet review. Positive boxes still require taxonomy/geometry QA because Open Images' broad `Knife` label includes examples that may not match the intended handheld-threat policy.

## Dataset/source feasibility

### Accepted for the pilot

- **Open Images V7/V5 metadata and CVDF-hosted images.** Box labels exist for `Knife`, `Kitchen knife`, `Scissors`, and `Paper cutter`. In the official validation/test annotations inspected, paper cutter had zero boxes; razor blade is not a boxable class. The chosen images declare CC BY 2.0 and annotations are published under CC BY 4.0. Attribution and per-image provenance must be retained.

### Researched but rejected or blocked

- **Roboflow Universe `cutting-tool-996fi`:** 28 images, CC BY 4.0 declaration, but ambiguous merged labels (`knifescissor`, `scissor-knife`) and insufficient source provenance. Not acceptable as training evidence.
- **SeCVOS utility-knife video:** relevant RGB video, but CC BY-NC-SA 4.0 prohibits the intended commercial deployment. Rejected.
- **X-ray prohibited-item datasets:** several contain cutter/razor classes but the imaging domain is not ordinary RGB CCTV. Rejected for this use.
- **Published RGB prohibited-object collections:** papers report box-cutter/razor content, but usable weights/data with clear public download, image provenance and commercial licence were not verified. Blocked pending rights-holder clarification.

Result: legally and technically usable knife/scissors seed data exists; a commercially usable RGB CCTV utility-knife and razor-blade bounding-box source was not found. Those classes must remain unsupported unless a rights-cleared source is acquired or an original collection is approved.

## Architecture feasibility

RT-DETRv2-R18 is the preferred pilot architecture candidate because the official implementation and PekingU checkpoint are Apache-2.0, the R18 checkpoint is about 80.9 MB / 20.2M parameters, and the architecture is intended for real-time detection. This is technically suitable for a bounded experiment and later ONNX evaluation.

Checkpoint licensing is not the same as training-image clearance. The public checkpoint is COCO-trained; COCO annotations are CC BY 4.0, while underlying Flickr images retain their individual terms. Legal review of checkpoint/data lineage is still recommended before proprietary commercial distribution. Dependency licences must be snapshotted before training; no checkpoint was downloaded into production and no architecture was integrated.

## Estimated manual preparation

| Scope | Estimated human effort |
|---|---:|
| Audit/correct the 37 positive pilot images and 61 boxes | 2–4 hours |
| Capture/select 150–250 source-separated, rights-cleared RGB CCTV frames/clips | 8–16 hours |
| Annotate boxes and class/occlusion attributes | 6–12 hours |
| Independent QA, duplicate/leakage and difficult-negative review | 3–6 hours |
| **Next bounded pilot total** | **17–34 hours** |

This estimate excludes permissions/contracts and assumes an experienced annotator with a pre-agreed class policy. Razor-blade and box-cutter collection is likely the largest blocker because small-object visibility and safe scene staging are difficult.

## GPU requirement and cost estimate (before training)

A later RT-DETRv2-R18 pilot at 640–960 px should start on a single 24 GB GPU, with mixed precision, early stopping and reproducible seeds. Budget 8–20 GPU-hours for setup, short sweeps and one confirmation run; CPU export/benchmarking is separate.

Using the current referenced RunPod rates, a 24 GB L4/A5000/3090 tier at USD 0.69/hour is approximately USD 5.52–13.80, while an RTX 4090 at USD 1.10/hour is approximately USD 8.80–22.00. Storage, tax, idle time and failed setup runs are extra. These are estimates, not an authorization to spend.

## Remaining blockers and stop condition

1. No rights-cleared, verified RGB CCTV utility-knife/box-cutter or razor-blade bounding-box corpus.
2. Existing seed data is strongly imbalanced and not CCTV-representative.
3. No small targets below 1% image area; limited occlusion and lighting diversity.
4. Sparse source annotations require manual positive/negative review.
5. CC BY attribution obligations and checkpoint lineage need commercial legal review.
6. A precise class policy is needed (kitchen knife vs sword/machete; closed vs open utility knife; loose razor blade vs shaving razor).

Training remains stopped. Recommended next approval is for the **17–34 hour controlled data-collection and annotation pilot**, not paid GPU training. After that evidence is audited, a separate approval should cover the bounded 8–20 GPU-hour experiment.
