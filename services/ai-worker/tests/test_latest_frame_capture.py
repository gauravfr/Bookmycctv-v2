import time
import numpy as np

from app.cameras.latest_frame_capture import LatestFrameCapture


class FakeCapture:
    def __init__(self): self.value, self.released = 0, False
    def read(self):
        time.sleep(.005)
        self.value += 1
        return True, np.full((2, 2, 3), self.value, dtype=np.uint8)
    def release(self): self.released = True


def test_latest_frame_replaces_stale_frames_and_releases_camera():
    fake = FakeCapture()
    capture = LatestFrameCapture(fake).start()
    first = capture.latest(timeout=.2)
    time.sleep(.04)
    latest = capture.latest(first.sequence, timeout=.2)
    capture.stop()
    assert latest.sequence > first.sequence + 1
    assert int(latest.frame[0, 0, 0]) > int(first.frame[0, 0, 0])
    assert fake.released is True
