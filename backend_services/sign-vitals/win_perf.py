"""
win_perf.py
Sign & Vitals — keep the backend at full speed on Windows 11 while the
browser is in front.

Windows 11 "power throttling" (EcoQoS) slows down background processes —
on hybrid CPUs it moves them to the efficiency cores. The backend and its
MediaPipe worker always run in the background (the learner is looking at
the browser), so an attempt's landmark extraction took ~160-240 ms per
frame instead of ~50 ms whenever a browser window was focused.

opt_out_of_power_throttling() asks Windows not to throttle this process
(SetProcessInformation / ProcessPowerThrottling, execution speed). It only
changes scheduling, never the computation: landmarks and results are
identical. A no-op on other systems or older Windows versions.
"""

import ctypes
from ctypes import wintypes
import logging
import sys

logger = logging.getLogger("sign_vitals")

_PROCESS_POWER_THROTTLING_INFORMATION_CLASS = 4  # ProcessPowerThrottling
_PROCESS_POWER_THROTTLING_CURRENT_VERSION = 1
_PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1


class _ThrottlingState(ctypes.Structure):
    _fields_ = [("Version", wintypes.ULONG), ("ControlMask", wintypes.ULONG), ("StateMask", wintypes.ULONG)]


def opt_out_of_power_throttling() -> bool:
    """True if Windows accepted the request (False elsewhere / on failure)."""
    if sys.platform != "win32":
        return False
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        # Explicit types: the process handle is 64-bit (a plain int is truncated and the call fails).
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        kernel32.SetProcessInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel32.SetProcessInformation.restype = wintypes.BOOL
        state = _ThrottlingState(_PROCESS_POWER_THROTTLING_CURRENT_VERSION,
                                 _PROCESS_POWER_THROTTLING_EXECUTION_SPEED, 0)  # control speed, state = not throttled
        ok = kernel32.SetProcessInformation(kernel32.GetCurrentProcess(), _PROCESS_POWER_THROTTLING_INFORMATION_CLASS,
                                            ctypes.byref(state), ctypes.sizeof(state))
        return bool(ok)
    except Exception:  # noqa: BLE001 — never block start-up over a scheduling hint
        logger.debug("power throttling opt-out not available", exc_info=True)
        return False
