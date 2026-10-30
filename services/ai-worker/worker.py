"""BookMyCCTV AI worker lifecycle reporter. It never fabricates detections."""
import json, os, time, urllib.request

API=os.environ.get("API_URL")
SECRET=os.environ.get("AI_WORKER_SHARED_SECRET")
ORG=os.environ.get("ORGANIZATION_ID")
WORKER=os.environ.get("WORKER_ID","ai-worker-1")
DETECTORS=("PERSON","CROWD","FIRE","SMOKE","SMOKING","SHARP_OBJECT")

def detector_status(kind):
    model=os.environ.get(f"{kind}_MODEL_PATH")
    if not model: return {"detectorId":kind.lower(),"type":kind,"state":"MODEL_UNAVAILABLE","errorCode":"MODEL_NOT_CONFIGURED"}
    if not os.path.isfile(model): return {"detectorId":kind.lower(),"type":kind,"state":"MODEL_UNAVAILABLE","errorCode":"MODEL_FILE_MISSING"}
    return {"detectorId":kind.lower(),"type":kind,"state":"NOT_CONFIGURED","errorCode":"RUNTIME_ADAPTER_NOT_CONFIGURED"}

def heartbeat():
    if not all((API,SECRET,ORG)): raise RuntimeError("API_URL, AI_WORKER_SHARED_SECRET and ORGANIZATION_ID are required")
    body=json.dumps({"organizationId":ORG,"workerId":WORKER,"detectors":[detector_status(d) for d in DETECTORS]}).encode()
    request=urllib.request.Request(f"{API}/api/v1/ingest/ai/health",body,{"Content-Type":"application/json","Authorization":f"Bearer {SECRET}"},method="POST")
    with urllib.request.urlopen(request,timeout=10) as response:
        if response.status != 200: raise RuntimeError(f"health rejected: {response.status}")

if __name__ == "__main__":
    while True:
        try: heartbeat()
        except Exception as exc: print(f"AI worker health failed: {type(exc).__name__}",flush=True)
        time.sleep(30)
