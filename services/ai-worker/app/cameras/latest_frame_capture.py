from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import threading
import time

import cv2


@dataclass(frozen=True)
class CapturedFrame:
    sequence: int
    captured_at: float
    frame: object


class LatestFrameCapture:
    """Continuously captures frames and exposes only the newest one.

    Consumers never queue camera frames behind slow inference. Replaced frames are
    counted so latency and dropped-frame behavior remain observable.
    """

    def __init__(self, capture, history_seconds: float = 2.0):
        self.capture = capture
        self.history_seconds = history_seconds
        self._condition = threading.Condition()
        self._latest: CapturedFrame | None = None
        self._sequence = 0
        self._consumed_sequence = 0
        self._capture_times = deque()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.error: str | None = None

    def start(self):
        if self._thread is not None:
            return self
        self._thread = threading.Thread(target=self._run, daemon=True, name="latest-frame-capture")
        self._thread.start()
        return self

    def _run(self):
        try:
            while not self._stop.is_set():
                ok, frame = self.capture.read()
                if not ok:
                    if not self._stop.is_set():
                        self.error = "CAMERA_READ_FAILED"
                    break
                now = time.monotonic()
                with self._condition:
                    self._sequence += 1
                    self._latest = CapturedFrame(self._sequence, now, frame)
                    self._capture_times.append(now)
                    cutoff = now - self.history_seconds
                    while self._capture_times and self._capture_times[0] < cutoff:
                        self._capture_times.popleft()
                    self._condition.notify_all()
        except Exception as error:
            self.error = type(error).__name__
        finally:
            with self._condition:
                self._condition.notify_all()

    def latest(self, after_sequence: int = 0, timeout: float = 0.0) -> CapturedFrame | None:
        deadline = time.monotonic() + timeout
        with self._condition:
            while (self._latest is None or self._latest.sequence <= after_sequence) and not self._stop.is_set():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None
                self._condition.wait(remaining)
            if self._latest is None or self._latest.sequence <= after_sequence:
                return None
            self._consumed_sequence = max(self._consumed_sequence, self._latest.sequence)
            return CapturedFrame(self._latest.sequence, self._latest.captured_at, self._latest.frame.copy())

    @property
    def capture_fps(self) -> float:
        with self._condition:
            if len(self._capture_times) < 2:
                return 0.0
            elapsed = self._capture_times[-1] - self._capture_times[0]
            return (len(self._capture_times) - 1) / elapsed if elapsed > 0 else 0.0

    @property
    def captured_frames(self) -> int:
        with self._condition:
            return self._sequence

    def stop(self):
        self._stop.set()
        with self._condition:
            self._condition.notify_all()
        # Releasing first unblocks a backend that is waiting inside read().
        self.capture.release()
        if self._thread is not None:
            self._thread.join(timeout=2.0)

