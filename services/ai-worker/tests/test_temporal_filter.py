from app.tracking.temporal_filter import TemporalFilter

def test_requires_consecutive_frames():
    subject = TemporalFilter(required_frames=3)
    assert subject.accept("camera:person", True, 0) is False
    assert subject.accept("camera:person", True, 0) is False
    assert subject.accept("camera:person", True, 0) is True

def test_negative_frame_resets_confirmation():
    subject = TemporalFilter(required_frames=2)
    assert subject.accept("camera:person", True, 0) is False
    assert subject.accept("camera:person", False, 0) is False
    assert subject.accept("camera:person", True, 0) is False

def test_persistence_duration_is_required(monkeypatch):
    times = iter([10.0, 11.0, 13.1])
    monkeypatch.setattr("app.tracking.temporal_filter.time.monotonic", lambda: next(times))
    subject = TemporalFilter(required_frames=2)
    assert subject.accept("camera:crowd", True, 0, 3) is False
    assert subject.accept("camera:crowd", True, 0, 3) is False
    assert subject.accept("camera:crowd", True, 0, 3) is True

def test_large_sample_gap_resets_consecutive_detections():
    subject = TemporalFilter(required_frames=3)
    assert subject.accept("camera:sharp", True, 0, now=1.0, max_gap_seconds=1.5) is False
    assert subject.accept("camera:sharp", True, 0, now=2.0, max_gap_seconds=1.5) is False
    assert subject.accept("camera:sharp", True, 0, now=5.0, max_gap_seconds=1.5) is False
    assert subject.states["camera:sharp"].consecutive == 1

def test_explicit_monotonic_timestamps_drive_persistence():
    subject = TemporalFilter(required_frames=2)
    assert subject.accept("camera:crowd", True, 0, 3, now=10.0) is False
    assert subject.accept("camera:crowd", True, 0, 3, now=13.1) is True
