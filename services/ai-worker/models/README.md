# AI model manifests

Reviewed COCO and fire/smoke ONNX weights are bundled with checksum-pinned manifests. Smoking activity, razor-blade and box-cutter models are not bundled because no candidate has passed the required provenance and real-inference checks. See `PROVENANCE.md` before enabling or replacing any model.

Each manifest must contain `modelId`, `version`, `file`, `labels`, `sha256`, and `outputFormat` (`yolo_v8` or `yolo_v5`), and may contain `inputSize`. The worker verifies the SHA-256 checksum and required labels before loading. A COCO detector is valid only for person and vehicle classes; it is never used as proof of fire, smoke, smoking, or sharp-object detection.

Example:

```json
{"modelId":"reviewed-yolo-coco","version":"1.0","file":"model.onnx","labels":["person","car","motorcycle","bus","truck"],"sha256":"REPLACE_WITH_REAL_SHA256","inputSize":640,"outputFormat":"yolo_v8"}
```

Record the upstream URL, author, training dataset, license, export settings, validation metrics, and checksum in a separate provenance document before enabling a model in production.
