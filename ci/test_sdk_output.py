from pathlib import Path
import subprocess
import tempfile
import unittest
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("sdk_output", ROOT / "tools/check_sdk_output.py")
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


class GeneratedOutputTests(unittest.TestCase):
    def test_untracked_and_ignored_new_output_cannot_pass_a_clean_git_diff(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = Path(folder)
            subprocess.run(["git", "init", "-q", str(repo)], check=True, capture_output=True)
            self.assertTrue(checker.clean(repo))
            (repo / "dist").mkdir()
            (repo / "dist/missing.js").write_text("export const value = 1;\n", encoding="utf-8")
            self.assertEqual(subprocess.run(["git", "-C", str(repo), "diff", "--exit-code", "--", "dist"], capture_output=True).returncode, 0)
            self.assertFalse(checker.clean(repo))
            (repo / ".gitignore").write_text("dist/\n", encoding="utf-8")
            self.assertFalse(checker.clean(repo))


if __name__ == "__main__":
    unittest.main()
