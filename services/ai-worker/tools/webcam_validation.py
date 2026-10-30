from __future__ import annotations

import argparse, json, statistics, sys, threading, time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
import cv2
import psutil
try:
    import msvcrt
except ImportError:
    msvcrt = None

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.cameras.latest_frame_capture import LatestFrameCapture
from app.cameras.stream_reader import ReconnectingCapture
from app.events.annotator import annotate
from app.inference.inference_engine import DetectorRegistry
from app.tracking.motion_analyzer import MotionAnalyzer
from app.tracking.temporal_filter import TemporalFilter

SCENARIOS = {ord("i"):("idle","none"), ord("k"):("knife","knife"), ord("x"):("scissors","scissors"),
 ord("p"):("pen","none"), ord("s"):("spoon","none"), ord("h"):("phone","none"),
 ord("e"):("empty-hands","none"), ord("c"):("crowd","crowd"), ord("n"):("no-movement","no-movement")}

@dataclass(frozen=True)
class Result:
    sequence: int; captured_at: float; completed_at: float; sharp: list; people: list
    raw_sharp: list; raw_people: list; latency_ms: float; model_latency_ms: dict

def normalize_key(key):
    key = key & 0xff
    return key + 32 if ord("A") <= key <= ord("Z") else key

def poll_key():
    key = cv2.waitKeyEx(1)
    if key >= 0: return normalize_key(key)
    if msvcrt is not None and msvcrt.kbhit():
        value = msvcrt.getwch()
        return normalize_key(ord(value)) if value else -1
    return -1

class InferenceWorker:
    """One worker, one latest frame, zero camera-frame queueing."""
    def __init__(self, capture, registry, args):
        self.capture, self.registry, self.args = capture, registry, args
        self.stop_event, self.lock = threading.Event(), threading.Lock()
        self.result, self.error, self.samples, self.dropped = None, None, 0, 0
        self.times = deque(maxlen=60)
        self.thread = threading.Thread(target=self._run, daemon=True, name="webcam-inference")
    def start(self): self.thread.start(); return self
    def _run(self):
        sequence, next_due = 0, time.monotonic()
        try:
            while not self.stop_event.is_set():
                now = time.monotonic()
                if now < next_due:
                    self.stop_event.wait(min(.05, next_due-now)); continue
                item = self.capture.latest(sequence, .25)
                if item is None: continue
                self.dropped += max(0, item.sequence-sequence-1); sequence = item.sequence
                started = time.perf_counter()
                outputs = self.registry.infer_frame(item.frame, {"SHARP_OBJECT_DETECTED","CROWD_GATHERING"})
                raw_sharp = self.registry.detections_for("SHARP_OBJECT_DETECTED", outputs, 0)
                raw_people = self.registry.detections_for("CROWD_GATHERING", outputs, 0)
                sharp = [d for d in raw_sharp if d.confidence >= self.args.confidence]
                people = [d for d in raw_people if d.confidence >= self.args.person_confidence]
                completed = time.monotonic()
                value = Result(sequence, item.captured_at, completed, sharp, people, raw_sharp, raw_people,
                               round((time.perf_counter()-started)*1000,2), dict(self.registry.last_latency_ms))
                with self.lock: self.result=value; self.samples+=1; self.times.append(completed)
                next_due = max(next_due + 1/self.args.sample_fps, completed)
        except Exception as error: self.error=f"{type(error).__name__}: {error}"
    def snapshot(self):
        with self.lock: return self.result
    @property
    def fps(self):
        with self.lock:
            return (len(self.times)-1)/(self.times[-1]-self.times[0]) if len(self.times)>1 and self.times[-1]>self.times[0] else 0
    def stop(self): self.stop_event.set(); self.thread.join(timeout=5)

def p95(values): return round(sorted(values)[max(0,int(len(values)*.95)-1)],2) if values else None
def open_camera(args):
    if args.source:
        return ReconnectingCapture(args.source)
    cap=cv2.VideoCapture(args.camera,{"auto":cv2.CAP_ANY,"dshow":cv2.CAP_DSHOW,"msmf":cv2.CAP_MSMF}[args.backend])
    if args.camera_codec != "none": cap.set(cv2.CAP_PROP_FOURCC,cv2.VideoWriter_fourcc(*args.camera_codec))
    cap.set(cv2.CAP_PROP_FPS,args.camera_fps)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,args.width); cap.set(cv2.CAP_PROP_FRAME_HEIGHT,args.height); return cap

def run(args):
    cv2.setNumThreads(args.opencv_threads)
    raw=open_camera(args)
    if not raw.isOpened(): raise RuntimeError(f"Cannot open webcam {args.camera}; close other camera apps and verify desktop camera access")
    capture=LatestFrameCapture(raw).start(); first=capture.latest(timeout=3)
    if first is None: capture.stop(); raise RuntimeError(f"Camera opened but returned no frame: {capture.error or 'timeout'}")
    height,width=first.frame.shape[:2]; args.output.parent.mkdir(parents=True,exist_ok=True)
    writer=cv2.VideoWriter(str(args.output),cv2.VideoWriter_fourcc(*"mp4v"),args.display_fps,(width,height))
    if not writer.isOpened(): capture.stop(); raise RuntimeError("Cannot create evidence video")
    registry=DetectorRegistry(args.model_dir); worker=InferenceWorker(capture,registry,args).start()
    sharp_filter,crowd_filter,motion=TemporalFilter(3),TemporalFilter(3),MotionAnalyzer()
    scenario,expectation="idle","none"; scenarios={}; events=[]; latencies=[]; per_model={}; display_times=deque(maxlen=120)
    transitions=[{"scenario":"idle","expectation":"none","atSeconds":0.0}]; detection_samples=[]; scenario_confirm_until=0.0
    cpu_samples=[]; process=psutil.Process(); process.cpu_percent(None)
    last_frame=last_result=stale=sharp_alerts=crowd_alerts=no_motion_alerts=0
    status,failure="interrupted",None; session_started=time.monotonic()
    def stats(): return scenarios.setdefault(scenario,{"samples":0,"sharpPositive":0,"knife":0,"scissors":0,"falsePositive":0,"missedExpected":0,"maxPersons":0,"crowdPositive":0})
    try:
        while True:
            item=capture.latest(last_frame,.1)
            if item is None:
                if capture.error: raise RuntimeError(capture.error)
                continue
            last_frame=item.sequence; now=time.monotonic(); display_times.append(now)
            motion_state=motion.update(item.frame,now=item.captured_at)
            if expectation=="no-movement" and motion.should_emit(motion_state,args.inactivity_seconds,args.no_movement_cooldown,now=item.captured_at):
                no_motion_alerts+=1; events.append({"type":"NO_MOVEMENT_DETECTED","scenario":scenario,"at":now-session_started})
            result=worker.snapshot(); sharp=[]; people=[]
            if result:
                if now-result.captured_at<=args.max_overlay_age: sharp,people=result.sharp,result.people
                else: stale+=1
                if result.sequence!=last_result:
                    last_result=result.sequence; latencies.append(result.latency_ms)
                    for name,value in result.model_latency_ms.items(): per_model.setdefault(name,[]).append(value)
                    labels={d.label for d in result.sharp}; detected=bool(result.sharp); crowd=len(result.people)>=args.crowd_count; s=stats()
                    detection_samples.append({"atSeconds":round(result.captured_at-session_started,3),"scenario":scenario,
                     "frameSequence":result.sequence,"frameAgeMs":round((now-result.captured_at)*1000,2),
                     "rawSharp":[{"label":d.label,"confidence":round(d.confidence,5),"box":list(d.box)} for d in result.raw_sharp],
                     "filteredSharp":[{"label":d.label,"confidence":round(d.confidence,5),"box":list(d.box)} for d in result.sharp],
                     "rawPersonCount":len(result.raw_people),"personCount":len(result.people),"latencyMs":result.latency_ms})
                    cpu_samples.append(process.cpu_percent(None))
                    s["samples"]+=1; s["sharpPositive"]+=int(detected); s["knife"]+=int("knife" in labels); s["scissors"]+=int("scissors" in labels)
                    s["falsePositive"]+=int(expectation=="none" and detected); s["missedExpected"]+=int(expectation in {"knife","scissors"} and expectation not in labels)
                    s["maxPersons"]=max(s["maxPersons"],len(result.people)); s["crowdPositive"]+=int(crowd)
                    gap=max(1.75/args.sample_fps,result.latency_ms/1000*1.5)
                    if sharp_filter.accept("sharp",detected,args.sharp_cooldown,args.sharp_persistence,now=result.captured_at,max_gap_seconds=gap):
                        sharp_alerts+=1; events.append({"type":"SHARP_OBJECT_DETECTED","scenario":scenario,"at":now-session_started})
                    if crowd_filter.accept("crowd",crowd,args.crowd_cooldown,args.crowd_persistence,now=result.captured_at,max_gap_seconds=gap):
                        crowd_alerts+=1; events.append({"type":"CROWD_GATHERING","scenario":scenario,"personCount":len(result.people),"at":now-session_started})
            display_fps=(len(display_times)-1)/(display_times[-1]-display_times[0]) if len(display_times)>1 else 0
            frame=annotate(item.frame,sharp+people,f"LIVE {scenario.upper()}",len(people)); state=sharp_filter.states.get("sharp")
            lines=[f"camera {capture.capture_fps:.1f} | display {display_fps:.1f} | inference {worker.fps:.2f} FPS",
             f"latency {(result.latency_ms if result else 0):.0f} ms | "+" ".join(f"{k} {v:.0f}" for k,v in (result.model_latency_ms.items() if result else [])),
             f"persons {len(people)}/{args.crowd_count} | knife {sum(d.label=='knife' for d in sharp)} | scissors {sum(d.label=='scissors' for d in sharp)} | sharp {state.consecutive if state else 0}/3",
             f"dropped {worker.dropped} | stale {stale} | inactivity {motion_state.inactivity_seconds:.0f}s | frozen {motion_state.frozen}",
             "K knife X scissors P pen S spoon H phone E empty C crowd N no-motion I idle Q quit"]
            for i,line in enumerate(lines): cv2.putText(frame,line,(10,24+i*22),cv2.FONT_HERSHEY_SIMPLEX,.52,(255,255,255),2,cv2.LINE_AA)
            if now < scenario_confirm_until:
                cv2.rectangle(frame,(width//4,height//2-55),(3*width//4,height//2+35),(0,0,0),-1)
                cv2.putText(frame,f"SCENARIO: {scenario.upper()}",(width//4+20,height//2),cv2.FONT_HERSHEY_SIMPLEX,1.05,(0,255,255),3,cv2.LINE_AA)
            writer.write(frame); cv2.imshow("BookMyCCTV V2 live production validation",frame); key=poll_key()
            if key==ord("q"): status="completed"; break
            if key in SCENARIOS:
                scenario,expectation=SCENARIOS[key]; stats(); scenario_confirm_until=now+2.0
                transitions.append({"scenario":scenario,"expectation":expectation,"atSeconds":round(now-session_started,3),"key":chr(key)})
                print(f"SCENARIO {scenario.upper()} at {now-session_started:.2f}s",flush=True)
    except KeyboardInterrupt: status="interrupted"
    except Exception as error: status="failed"; failure=f"{type(error).__name__}: {error}"
    finally:
        worker.stop(); capture.stop(); writer.release(); cv2.destroyAllWindows()
        display_fps=(len(display_times)-1)/(display_times[-1]-display_times[0]) if len(display_times)>1 else 0
        report={"sessionStatus":status,"liveWebcamVerified":status=="completed","failure":failure,"resolution":[width,height],
         "captureFps":round(capture.capture_fps,2),"displayFps":round(display_fps,2),"inferenceFps":round(worker.fps,3),
         "samples":worker.samples,"droppedBeforeInference":worker.dropped,"staleDisplayFrames":stale,
         "meanLatencyMs":round(statistics.mean(latencies),2) if latencies else None,"p95LatencyMs":p95(latencies),
         "meanProcessCpuPercent":round(statistics.mean(cpu_samples),2) if cpu_samples else None,"p95ProcessCpuPercent":p95(cpu_samples),
         "perModelLatencyMs":{k:{"mean":round(statistics.mean(v),2),"p95":p95(v)} for k,v in per_model.items()},
         "settings":{"sampleFps":args.sample_fps,"sharpConfidence":args.confidence,"personConfidence":args.person_confidence,"crowdCount":args.crowd_count,"inactivitySeconds":args.inactivity_seconds,"opencvThreads":args.opencv_threads,
          "requestedCameraFps":args.camera_fps,"requestedCameraCodec":args.camera_codec},
         "alerts":{"sharp":sharp_alerts,"crowd":crowd_alerts,"noMovement":no_motion_alerts},"scenarios":scenarios,"scenarioTransitions":transitions,
         "detectionSamples":detection_samples,"events":events,
         "modelStatuses":registry.statuses,"modelErrors":registry.last_errors,"captureError":capture.error,"inferenceError":worker.error,"evidenceVideo":str(args.output.resolve())}
        args.output.with_suffix(".json").write_text(json.dumps(report,indent=2),encoding="utf-8"); print(json.dumps(report,indent=2))

if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("--camera",type=int,default=0); p.add_argument("--source",help="Local RTSP or HTTP/MJPEG URL; stays on the LAN")
    p.add_argument("--backend",choices=("auto","dshow","msmf"),default="dshow")
    p.add_argument("--model-dir",type=Path,default=Path(__file__).resolve().parents[1]/"models"); p.add_argument("--output",type=Path,default=Path(__file__).resolve().parents[3]/"demo"/"output"/"live-webcam-validation.mp4")
    p.add_argument("--width",type=int,default=1280); p.add_argument("--height",type=int,default=720); p.add_argument("--camera-fps",type=float,default=30)
    p.add_argument("--camera-codec",choices=("MJPG","YUY2","none"),default="MJPG"); p.add_argument("--display-fps",type=float,default=20)
    p.add_argument("--sample-fps",type=float,default=1); p.add_argument("--confidence",type=float,default=.5); p.add_argument("--person-confidence",type=float,default=.35)
    p.add_argument("--max-overlay-age",type=float,default=2.5); p.add_argument("--opencv-threads",type=int,default=4); p.add_argument("--sharp-persistence",type=float,default=2)
    p.add_argument("--sharp-cooldown",type=float,default=30); p.add_argument("--crowd-count",type=int,default=3); p.add_argument("--crowd-persistence",type=float,default=3)
    p.add_argument("--crowd-cooldown",type=float,default=60); p.add_argument("--inactivity-seconds",type=float,default=300); p.add_argument("--no-movement-cooldown",type=float,default=300)
    run(p.parse_args())
