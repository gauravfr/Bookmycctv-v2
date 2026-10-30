from dataclasses import dataclass
import time

import cv2
import numpy as np


@dataclass(frozen=True)
class MotionState:
    valid: bool
    meaningful_motion: bool
    frozen: bool
    inactivity_seconds: float
    changed_ratio: float


class MotionAnalyzer:
    def __init__(self, pixel_threshold: int = 20, changed_ratio_threshold: float = 0.012, frozen_seconds: float = 30):
        self.pixel_threshold = pixel_threshold
        self.changed_ratio_threshold = changed_ratio_threshold
        self.frozen_seconds = frozen_seconds
        self.previous = None
        self.last_motion_at = None
        self.identical_since = None
        self.last_event_at = None

    @staticmethod
    def _prepare(frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (320, 180), interpolation=cv2.INTER_AREA)
        return cv2.GaussianBlur(gray, (5, 5), 0)

    def update(self, frame, now: float | None = None) -> MotionState:
        current_time = time.monotonic() if now is None else now
        current = self._prepare(frame)
        if self.previous is None:
            self.previous = current
            self.last_motion_at = current_time
            self.identical_since = current_time
            return MotionState(True, False, False, 0, 0)
        raw = current.astype(np.int16) - self.previous.astype(np.int16)
        # Remove a global luminance shift so sunrise, cloud cover, or exposure changes
        # do not count as scene movement.
        adjusted = np.abs(raw - np.median(raw))
        changed_ratio = float(np.count_nonzero(adjusted >= self.pixel_threshold) / adjusted.size)
        exact_repeat = bool(np.array_equal(current, self.previous))
        if exact_repeat:
            if self.identical_since is None:
                self.identical_since = current_time
        else:
            self.identical_since = None
        frozen = self.identical_since is not None and current_time - self.identical_since >= self.frozen_seconds
        meaningful = changed_ratio >= self.changed_ratio_threshold and not frozen
        if meaningful:
            self.last_motion_at = current_time
        self.previous = current
        last_motion = current_time if self.last_motion_at is None else self.last_motion_at
        inactivity = max(0.0, current_time - last_motion)
        return MotionState(True, meaningful, frozen, inactivity, changed_ratio)

    def should_emit(self, state: MotionState, required_seconds: float, cooldown_seconds: float, now: float | None = None) -> bool:
        current_time = time.monotonic() if now is None else now
        if not state.valid or state.frozen or state.inactivity_seconds < required_seconds:
            return False
        if self.last_event_at is not None and current_time - self.last_event_at < cooldown_seconds:
            return False
        self.last_event_at = current_time
        return True
