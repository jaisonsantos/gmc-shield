from pathlib import Path
from typing import Tuple

ARTIFACTS_ROOT = Path(__file__).resolve().parents[2]


def snapshot_paths(store_id: int, run_id: int, feed_item_id: str, ua: str) -> Tuple[Path, Path]:
    """Return relative paths for HTML and PNG artifacts and ensure directory exists."""
    rel_dir = Path(f"artifacts/store{store_id}/runs/{run_id}/items/{feed_item_id}/{ua}")
    abs_dir = ARTIFACTS_ROOT / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)
    return rel_dir / "page.html", rel_dir / "page.png"
