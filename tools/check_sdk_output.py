"""Reject changed, missing, untracked or ignored SDK output after compilation."""
from pathlib import Path
import subprocess


def clean(repo):
    result = subprocess.run(["git", "-C", str(repo), "status", "--porcelain=v1",
                             "--untracked-files=all", "--ignored=matching", "--", "dist"],
                            capture_output=True, text=True, timeout=30, check=True)
    return not result.stdout.strip()


if __name__ == "__main__":
    if not clean(Path(__file__).resolve().parents[1]):
        raise SystemExit("Generated SDK output must match committed files, including newly emitted files")
