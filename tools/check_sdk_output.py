"""Reject changed, missing, untracked or ignored SDK output after compilation."""
from pathlib import Path
import subprocess


def clean(repo):
    # Compare actual content through Git's text filters. Porcelain can report a
    # dirty stat after a Windows compiler replaces a CRLF checkout with LF.
    tracked = subprocess.run(["git", "-C", str(repo), "diff", "--exit-code", "HEAD", "--", "dist"],
                             capture_output=True, timeout=30)
    if tracked.returncode not in (0, 1):
        raise RuntimeError("Could not compare committed SDK content")
    # Without exclusion flags, --others includes ignored files as well.
    others = subprocess.run(["git", "-C", str(repo), "ls-files", "--others", "-z", "--", "dist"],
                            capture_output=True, timeout=30, check=True)
    return tracked.returncode == 0 and not others.stdout


if __name__ == "__main__":
    if not clean(Path(__file__).resolve().parents[1]):
        raise SystemExit("Generated SDK output must match committed files, including newly emitted files")
