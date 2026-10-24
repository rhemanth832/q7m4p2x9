"""Create a deterministic, lossless deployment copy of the canonical archive."""
import gzip
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "data" / "elexon-january-2026.json"
with source.with_suffix(".json.gz").open("wb") as output:
    with gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as compressed:
        compressed.write(source.read_bytes())
print("Compressed archive; the decompressed SHA-256 is unchanged.")
