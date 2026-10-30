from __future__ import annotations

import argparse, json, sys, time
from pathlib import Path
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.inference.inference_engine import DetectorRegistry

def crop_bounds(box, frame_shape, padding):
    x,y,w,h=map(int,box); height,width=frame_shape[:2]
    return max(0,x-padding),max(0,y-padding),min(width,x+w+padding),min(height,y+h+padding)


def run(args):
    capture = cv2.VideoCapture(str(args.source))
    if not capture.isOpened(): raise RuntimeError(f"Cannot open {args.source}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 1.0
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frames / fps
    args.output.mkdir(parents=True, exist_ok=True)
    registry = DetectorRegistry(args.model_dir)
    records=[]; second=0.0
    while second < duration:
        capture.set(cv2.CAP_PROP_POS_MSEC, second*1000)
        ok, frame = capture.read()
        if not ok: break
        started=time.perf_counter(); outputs=registry.infer_frame(frame,{"SHARP_OBJECT_DETECTED","CROWD_GATHERING"})
        raw=registry.detections_for("SHARP_OBJECT_DETECTED",outputs,0)
        people=[d for d in registry.detections_for("CROWD_GATHERING",outputs,0) if d.confidence>=args.person_confidence]
        candidates=[]
        for index,detection in enumerate(raw):
            x1,y1,x2,y2=crop_bounds(detection.box,frame.shape,args.crop_padding)
            crop_name=None
            if detection.confidence>=args.candidate_confidence and x2>x1 and y2>y1:
                crop_name=f"t{second:07.2f}_{detection.label}_{detection.confidence:.3f}_{index}.jpg"
                cv2.imwrite(str(args.output/crop_name),frame[y1:y2,x1:x2])
            candidates.append({"label":detection.label,"confidence":round(detection.confidence,5),"box":list(detection.box),"crop":crop_name})
        if candidates:
            records.append({"timestampSeconds":round(second,3),"latencyMs":round((time.perf_counter()-started)*1000,2),
                            "personCount":len(people),"candidates":candidates})
        second += args.interval
    capture.release()
    report={"source":str(args.source.resolve()),"sourceIsAnnotatedEvidence":True,
            "limitation":"The validator saved annotated display frames, not pristine camera frames. Re-inference can be influenced by overlays; crops must be visually inspected and are evaluation-only.",
            "fps":fps,"frames":frames,"durationSeconds":round(duration,3),"sampleIntervalSeconds":args.interval,
            "candidateConfidence":args.candidate_confidence,"productionConfidence":args.production_confidence,
            "records":records}
    target=args.output/"analysis.json"; target.write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"report":str(target),"records":len(records),"crops":sum(1 for r in records for c in r["candidates"] if c["crop"])},indent=2))


if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("source",type=Path); p.add_argument("--model-dir",type=Path,default=Path(__file__).resolve().parents[1]/"models")
    p.add_argument("--output",type=Path,required=True); p.add_argument("--interval",type=float,default=1.0)
    p.add_argument("--candidate-confidence",type=float,default=.25); p.add_argument("--production-confidence",type=float,default=.5)
    p.add_argument("--person-confidence",type=float,default=.35); p.add_argument("--crop-padding",type=int,default=24); run(p.parse_args())
