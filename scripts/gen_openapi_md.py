import pathlib
import sys

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / "api"))
from app.main import app  # noqa: E402


def main() -> None:
    spec = app.openapi()
    lines = ["# OpenAPI Paths"]
    for path, methods in sorted(spec.get("paths", {}).items()):
        for method in sorted(methods.keys()):
            lines.append(f"- {method.upper()} {path}")
    sys.stdout.write("\n".join(lines))


if __name__ == "__main__":
    main()
