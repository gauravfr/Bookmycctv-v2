import cv2


COLORS = {
    "person": (46, 204, 113),
    "knife": (40, 40, 230),
    "scissors": (0, 140, 255),
}


def annotate(frame, detections, title: str, person_count: int | None = None):
    output = frame.copy()
    for item in detections:
        x, y, width, height = item.box
        color = COLORS.get(item.label, (255, 180, 30))
        cv2.rectangle(output, (x, y), (x + width, y + height), color, 2)
        label = f"{item.label} {item.confidence:.2f}"
        cv2.putText(output, label, (x, max(20, y - 7)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
    heading = title if person_count is None else f"{title} | people: {person_count}"
    cv2.rectangle(output, (0, 0), (min(output.shape[1], 520), 38), (8, 16, 28), -1)
    cv2.putText(output, heading, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    return output
