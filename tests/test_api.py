import csv
from io import StringIO
import json

from fastapi.testclient import TestClient

from backend.app import app
from backend.analysis import ROOT

client = TestClient(app)


def test_health_and_metadata():
    assert client.get("/api/health").json()["status"] == "ok"
    meta = client.get("/api/meta").json()
    assert len(meta["requests"]) == 64
    assert len(meta["snapshotSHA256"]) == 64
    assert meta["forecastTargetMinutes"] == [0]


def test_day_contract_and_csv():
    response = client.get("/api/day?decision_date=2026-01-31&cutoff=09:50")
    assert response.status_code == 200
    assert response.json()["deliveryDate"] == "2026-02-01"
    exported = client.get("/api/export.csv?decision_date=2026-01-31&cutoff=09:50")
    rows = list(csv.DictReader(StringIO(exported.text)))
    assert len(rows) == 48
    assert rows[1]["forecastMW"] == ""
    assert "attachment" in exported.headers["content-disposition"]


def test_input_validation():
    for query in ["decision_date=2026-02-01", "decision_date=2025-12-31", "decision_date=invalid", "cutoff=25:00", "cutoff=9:50", "cutoff=09:60"]:
        assert client.get(f"/api/day?{query}").status_code == 422
    assert client.get("/api/month?cutoff=bad").status_code == 422


def test_python_generated_preview_matches_api_exactly():
    for cutoff in ["09:00", "09:20", "09:50"]:
        compact = cutoff.replace(":", "")
        expected = json.loads((ROOT / "public" / "snapshots" / f"day-2026-01-14-{compact}.json").read_text())
        assert client.get(f"/api/day?decision_date=2026-01-14&cutoff={cutoff}").json() == expected
