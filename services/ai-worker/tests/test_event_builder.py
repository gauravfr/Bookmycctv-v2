from app.events.event_builder import build_event

def test_event_contains_traceability_fields():
    event = build_event("camera-1", "PERSON_DETECTED", "person", "1.0", 0.91, 2)
    assert event["cameraId"] == "camera-1"
    assert event["confidence"] == 0.91
    assert event["metadata"] == {"objectCount": 2, "inferenceVerified": True}
    assert len(event["sourceEventId"]) == 64
