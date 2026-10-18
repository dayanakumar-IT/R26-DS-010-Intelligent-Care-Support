"""
tests/test_win_perf.py
Windows 11 power throttling (EcoQoS) slowed the background backend 3-4x
whenever the browser was in front (~50 -> ~190 ms per MediaPipe frame).
The server and the MediaPipe worker opt out at start (win_perf.py):

  - both Python environments (.venv and .venv_mediapipe) accept the opt-out;
  - the long-running MediaPipe worker reports it in its "ready" line.

Scheduling only: the parity tests show the results are unchanged.

Run with .venv's python:
    python tests/test_win_perf.py
"""

import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import extract_landmarks_bridge as bridge  # noqa: E402
import win_perf  # noqa: E402


def main():
    if sys.platform != "win32":
        print("WIN PERF TEST SKIPPED: not Windows")
        return
    assert win_perf.opt_out_of_power_throttling(), "server process: opt-out refused"
    mp_python = bridge._find_mediapipe_python() if hasattr(bridge, "_find_mediapipe_python") else None
    mp_python = mp_python or next(p for p in bridge._MEDIAPIPE_PYTHON_CANDIDATES if os.path.exists(p))
    out = subprocess.run([mp_python, "-c", "import win_perf; print(win_perf.opt_out_of_power_throttling())"],
                         cwd=ROOT, capture_output=True, text=True, timeout=60).stdout.strip()
    assert out == "True", f"MediaPipe environment: opt-out refused ({out!r})"
    print("  ok  both environments opt out of power throttling")

    proc = subprocess.Popen([mp_python, os.path.join(ROOT, "extract_landmarks_server.py")], cwd=ROOT,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        ready = None
        for line in proc.stdout:
            try:
                ready = json.loads(line)
                if ready.get("ready"):
                    break
            except ValueError:
                continue
        assert ready and ready.get("unthrottled") is True, f"worker ready line: {ready}"
        print("  ok  the long-running MediaPipe worker runs unthrottled")
    finally:
        proc.kill()
    print("WIN PERF TEST PASSED")


if __name__ == "__main__":
    main()
