# AI pipeline

The optional AI worker performs real RTSP frame sampling and checksum-validated ONNX inference outside the API process. It fetches organization-scoped camera/rule configuration, shares each model's inference result across compatible rules, applies confidence and temporal filters, captures integrity-protected JPEG evidence, and submits authenticated events to the existing backend pipeline.

`camera config → bounded RTSP workers → letterbox preprocessing → ONNX inference → per-rule filtering → persistence/cooldown → evidence capture → authenticated ingestion → MongoDB → authorized evidence retrieval`

Person, vehicle, count-based crowd, knife, and scissors rules may share a compatible COCO model. Razor blade and box cutter are not claimed by the COCO model; supporting those classes requires an independently reviewed RGB CCTV model. Fire/smoke and smoking rules require independent reviewed models containing their required labels. A detector is `MODEL_UNAVAILABLE` when its manifest, checksum, labels, or model file is missing or invalid; synthetic detections are never generated.

The backend limits event and evidence access by organization and camera assignment. Evidence filenames are treated as basenames, paths are containment-checked, hashes are verified before delivery, and responses are not cached. Retention is controlled by `AI_EVIDENCE_MAX_AGE_DAYS`.

Loading successfully is not detector verification. Verification additionally requires licensed positive and negative footage, real model execution, expected-result records, backend persistence, and retrieval by an authorized client. Visual results are uncertain indicators, not certified alarm-system replacements.
