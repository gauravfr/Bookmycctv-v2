from tools.analyze_webcam_evidence import crop_bounds
from tools.webcam_validation import normalize_key


def test_scenario_keys_accept_uppercase_and_lowercase():
    assert normalize_key(ord("K")) == ord("k")
    assert normalize_key(ord("x")) == ord("x")
    assert normalize_key(ord("Q")) == ord("q")


def test_evidence_crop_uses_xywh_and_clamps_to_frame():
    assert crop_bounds((100, 50, 40, 20), (200, 300, 3), 10) == (90, 40, 150, 80)
    assert crop_bounds((0, 0, 20, 20), (100, 100, 3), 10) == (0, 0, 30, 30)
