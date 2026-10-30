from __future__ import annotations
import time
import cv2
import threading

class ReconnectingCapture:
    """VideoCapture-compatible LAN stream reader with bounded reconnect backoff."""
    def __init__(self, uri: str, reconnect_min: float = 1.0, reconnect_max: float = 8.0):
        self.uri, self.reconnect_min, self.reconnect_max = uri, reconnect_min, reconnect_max
        self.released = threading.Event(); self.capture = None; self._open()
    def _open(self):
        self.capture = cv2.VideoCapture(self.uri, cv2.CAP_FFMPEG)
    def isOpened(self): return self.capture is not None and self.capture.isOpened()
    def read(self):
        delay=self.reconnect_min
        while not self.released.is_set():
            if self.capture is not None:
                ok,frame=self.capture.read()
                if ok: return True,frame
                self.capture.release()
            if self.released.wait(delay): break
            self._open(); delay=min(self.reconnect_max,delay*2)
        return False,None
    def get(self, prop): return self.capture.get(prop) if self.capture is not None else 0
    def set(self, prop, value): return self.capture.set(prop,value) if self.capture is not None else False
    def release(self):
        self.released.set()
        if self.capture is not None: self.capture.release()

class StreamReader:
    def __init__(self, uri: str, sample_fps: float, reconnect_min: float, reconnect_max: float):
        self.uri, self.interval, self.reconnect_min, self.reconnect_max = uri, 1 / sample_fps, reconnect_min, reconnect_max

    def frames(self, camera_stopped, worker_stopped):
        delay = self.reconnect_min
        while not camera_stopped.is_set() and not worker_stopped.is_set():
            capture = cv2.VideoCapture(self.uri, cv2.CAP_FFMPEG)
            if not capture.isOpened():
                capture.release(); camera_stopped.wait(delay); delay = min(self.reconnect_max, delay * 2); continue
            delay, next_frame = self.reconnect_min, 0.0
            try:
                while not camera_stopped.is_set() and not worker_stopped.is_set():
                    ok, frame = capture.read()
                    if not ok: break
                    now = time.monotonic()
                    if now >= next_frame:
                        next_frame = now + self.interval
                        yield frame
            finally: capture.release()
