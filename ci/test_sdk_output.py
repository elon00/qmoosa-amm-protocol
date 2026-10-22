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
            subprocess.run(["git", "-C", str(repo), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                            "commit", "--allow-empty", "-qm", "fixture"], check=True, capture_output=True)
            self.assertTrue(checker.clean(repo))
            (repo / "dist").mkdir()
            (repo / "dist/missing.js").write_text("export const value = 1;\n", encoding="utf-8")
            self.assertEqual(subprocess.run(["git", "-C", str(repo), "diff", "--exit-code", "--", "dist"], capture_output=True).returncode, 0)
            self.assertFalse(checker.clean(repo))
            (repo / ".gitignore").write_text("dist/\n", encoding="utf-8")
            self.assertFalse(checker.clean(repo))

    def test_windows_checkout_line_endings_do_not_hide_real_content_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = Path(folder)
            subprocess.run(["git", "init", "-q", str(repo)], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(repo), "config", "core.autocrlf", "true"], check=True)
            (repo / "dist").mkdir()
            output = repo / "dist/index.js"
            output.write_bytes(b"export const value = 1;\r\n")
            subprocess.run(["git", "-C", str(repo), "add", "dist"], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(repo), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                            "commit", "-qm", "fixture"], check=True, capture_output=True)
            output.write_bytes(b"export const value = 1;\n")
            self.assertTrue(checker.clean(repo))
            output.write_bytes(b"export const value = 2;\n")
            self.assertFalse(checker.clean(repo))


if __name__ == "__main__":
    unittest.main()
