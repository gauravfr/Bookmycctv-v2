# BookMyCCTV AI worker

This is a real RTSP frame-processing service. It fetches organization-scoped camera sources and detector rules from the authenticated backend, decodes RTSP with OpenCV/FFmpeg, samples frames, runs checksum-validated ONNX models, applies consecutive-frame and cooldown filtering, and submits genuine inference events to the existing backend pipeline. It never writes directly to MongoDB.

## Boundaries

- CPU is the default. `AI_USE_CUDA=true` requires an OpenCV build with CUDA and compatible host drivers; the supplied image is CPU-only.
- No weights are bundled. A detector is `MODEL_UNAVAILABLE` until a reviewed manifest and model are mounted under `/models`.
- The reviewed COCO model supports person, vehicle, person-count crowd, knife, and scissors detection. Razor-blade and box-cutter detection remain unsupported until a separately reviewed RGB CCTV model with those exact labels is supplied. Fire, smoke, and smoking require separately trained models with their exact labels.
- RTSP URLs are delivered only to a worker authenticated by the shared secret, organization ID, worker ID, and a ready detector registration. Logs redact URL credentials.
- OS push remains dependent on the separately configured Expo notification infrastructure.

## Runtime flow

`backend camera config → bounded camera thread → RTSP decoder → frame sampler → ONNX detector → label/confidence filter → temporal filter → authenticated event ingestion → MongoDB event → authorized mobile event list`

`app/config` owns validated settings. `app/cameras` owns stream and thread lifecycle. `app/inference` loads and validates models. `app/detectors` owns model output interpretation and detector class requirements. `app/tracking` owns temporal validation. `app/events` creates stable event envelopes. `app/integrations` is the only backend client.

## Models

Follow [models/README.md](models/README.md). Do not use a model unless its provenance, license, labels, metrics, export settings, version, and SHA-256 are recorded. The worker refuses checksum mismatches and models missing required classes.

## Commands

From the repository root:

```powershell
docker compose up -d mongodb mediamtx api
docker compose --profile ai up --build ai-worker
docker compose logs -f ai-worker
```

Local Python development requires Python 3.12:

```powershell
cd services\ai-worker
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:PYTHONPATH=(Get-Location).Path
python -m app.main
```

## Verification standard

A detector is not considered verified because it loads. Verification requires licensed positive and negative video, recorded expected results, real model execution, backend persistence, and retrieval through an authorized client account. Those assets are intentionally not fabricated or bundled.
