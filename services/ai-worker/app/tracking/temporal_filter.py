from __future__ import annotations
from dataclasses import dataclass
import time

@dataclass
class State:
    consecutive: int = 0
    first_detected: float | None = None
    last_emitted: float = 0
    last_observed: float | None = None

class TemporalFilter:
    def __init__(self, required_frames: int = 3): self.required_frames, self.states = required_frames, {}
    def accept(self, key: str, detected: bool, cooldown_seconds: int, persistence_seconds: float = 0,
               now: float | None = None, max_gap_seconds: float | None = None) -> bool:
        state = self.states.setdefault(key, State())
        now = time.monotonic() if now is None else now
        if max_gap_seconds is not None and state.last_observed is not None and now - state.last_observed > max_gap_seconds:
            state.consecutive = 0
            state.first_detected = None
        state.last_observed = now
        if not detected:
            state.consecutive = 0
            state.first_detected = None
            return False
        state.consecutive += 1
        if state.first_detected is None: state.first_detected = now
        if state.consecutive < self.required_frames or now - state.first_detected < persistence_seconds or now - state.last_emitted < cooldown_seconds: return False
        state.last_emitted = now
        state.consecutive = 0
        state.first_detected = None
        return True
