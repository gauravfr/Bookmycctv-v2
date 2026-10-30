from app.cameras.stream_reader import ReconnectingCapture


class FakeCapture:
    def __init__(self, succeeds): self.succeeds, self.released = succeeds, False
    def isOpened(self): return True
    def read(self): return (True, "frame") if self.succeeds else (False, None)
    def release(self): self.released = True
    def get(self, _): return 0
    def set(self, _, __): return True


def test_lan_capture_reconnects_after_read_failure(monkeypatch):
    captures = iter([FakeCapture(False), FakeCapture(True)])
    monkeypatch.setattr("app.cameras.stream_reader.cv2.VideoCapture", lambda *args: next(captures))
    subject = ReconnectingCapture("rtsp://192.168.1.10/live", .001, .002)
    ok, frame = subject.read()
    subject.release()
    assert ok is True
    assert frame == "frame"
