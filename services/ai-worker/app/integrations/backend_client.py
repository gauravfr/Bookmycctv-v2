from __future__ import annotations
import json
from typing import Any
from urllib.request import Request, urlopen

class BackendClient:
    def __init__(self, api_url: str, secret: str, organization_id: str, worker_id: str):
        self.api_url, self.secret, self.organization_id, self.worker_id = api_url, secret, organization_id, worker_id

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        encoded = json.dumps(body).encode() if body is not None else None
        request = Request(self.api_url + path, encoded, {"Accept": "application/json", "Content-Type": "application/json", "Authorization": f"Bearer {self.secret}", "X-Organization-Id": self.organization_id, "X-Worker-Id": self.worker_id}, method=method)
        with urlopen(request, timeout=15) as response:
            payload = json.load(response)
        if not payload.get("success"): raise RuntimeError("Backend rejected worker request")
        return payload["data"]

    def heartbeat(self, detectors: list[dict[str, Any]]) -> None:
        self._request("POST", "/api/v1/ingest/ai/health", {"organizationId": self.organization_id, "workerId": self.worker_id, "detectors": detectors})

    def cameras(self) -> list[dict[str, Any]]:
        return self._request("GET", "/api/v1/ingest/ai/cameras")["items"]

    def send_event(self, event: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/v1/ingest/ai/events", event)
