"""Produce a read-only UI preview from the exact same Python analysis.

The deployed Python API is authoritative. The optional static preview is labeled
and supports three audited auction cutoffs; it never recomputes metrics in JS.
"""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.analysis import repository, snapshot_sha256

root = Path(__file__).resolve().parents[1]
repo = repository()
out = root / "public" / "snapshots"
out.mkdir(exist_ok=True)
for cutoff in ["09:00", "09:20", "09:50"]:
    month = repo.month(cutoff)
    for day in month["days"]:
        result = repo.day(day["decisionDate"], cutoff)
        (out / f"day-{day['decisionDate']}-{cutoff.replace(':', '')}.json").write_text(json.dumps(result, separators=(",", ":"), allow_nan=False))
    (out / f"month-{cutoff.replace(':', '')}.json").write_text(json.dumps(month, separators=(",", ":"), allow_nan=False))
(out / "meta.json").write_text(json.dumps({**repo.meta(), "snapshotSHA256": snapshot_sha256()}, separators=(",", ":"), allow_nan=False))
print(f"Exported {len(list(out.glob('*.json')))} verified snapshot files")
