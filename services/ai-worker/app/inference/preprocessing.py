from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class LetterboxTransform:
    scale: float
    pad_x: int
    pad_y: int
    original_width: int
    original_height: int

    def restore_box(self, cx: float, cy: float, width: float, height: float) -> tuple[int, int, int, int]:
        left = (cx - width / 2 - self.pad_x) / self.scale
        top = (cy - height / 2 - self.pad_y) / self.scale
        right = (cx + width / 2 - self.pad_x) / self.scale
        bottom = (cy + height / 2 - self.pad_y) / self.scale
        left = max(0, min(self.original_width, round(left)))
        top = max(0, min(self.original_height, round(top)))
        right = max(left, min(self.original_width, round(right)))
        bottom = max(top, min(self.original_height, round(bottom)))
        return left, top, right - left, bottom - top


def letterbox(frame: np.ndarray, size: int) -> tuple[np.ndarray, LetterboxTransform]:
    height, width = frame.shape[:2]
    scale = min(size / width, size / height)
    resized_width, resized_height = round(width * scale), round(height * scale)
    resized = cv2.resize(frame, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)
    pad_x, pad_y = (size - resized_width) // 2, (size - resized_height) // 2
    canvas = np.full((size, size, 3), 114, dtype=frame.dtype)
    canvas[pad_y:pad_y + resized_height, pad_x:pad_x + resized_width] = resized
    return canvas, LetterboxTransform(scale, pad_x, pad_y, width, height)
