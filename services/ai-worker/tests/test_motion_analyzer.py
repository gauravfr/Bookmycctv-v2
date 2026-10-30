import numpy as np

from app.tracking.motion_analyzer import MotionAnalyzer


def frame(value=0):
    return np.full((360, 640, 3), value, dtype=np.uint8)


def test_global_lighting_change_does_not_count_as_motion():
    analyzer = MotionAnalyzer(frozen_seconds=999)
    analyzer.update(frame(30), now=0)
    state = analyzer.update(frame(80), now=10)
    assert not state.meaningful_motion
    assert state.inactivity_seconds == 10


def test_meaningful_motion_resets_elapsed_inactivity():
    analyzer = MotionAnalyzer(frozen_seconds=999)
    analyzer.update(frame(), now=0)
    moved = frame()
    moved[50:250, 50:350] = 255
    state = analyzer.update(moved, now=200)
    assert state.meaningful_motion
    assert state.inactivity_seconds == 0


def test_300_real_seconds_and_cooldown_are_required():
    analyzer = MotionAnalyzer(frozen_seconds=999)
    analyzer.update(frame(), now=0)
    state = analyzer.update(frame(1), now=299.99)
    assert not analyzer.should_emit(state, 300, 60, now=299.99)
    state = analyzer.update(frame(2), now=300)
    assert analyzer.should_emit(state, 300, 60, now=300)
    assert not analyzer.should_emit(state, 300, 60, now=301)


def test_exactly_repeated_frames_are_classified_as_frozen_not_inactive():
    analyzer = MotionAnalyzer(frozen_seconds=30)
    analyzer.update(frame(), now=0)
    state = analyzer.update(frame(), now=31)
    assert state.frozen
    assert not analyzer.should_emit(state, 30, 60, now=31)
