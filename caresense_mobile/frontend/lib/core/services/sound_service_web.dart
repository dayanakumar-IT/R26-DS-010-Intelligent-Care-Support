// Web Audio API beep via dart:js - works in Chrome without any extra packages
// ignore: avoid_web_libraries_in_flutter
import 'dart:js' as js;
import 'dart:async';

class SoundService {
  static js.JsObject? _ctx;
  static bool _highPlaying = false;
  static Timer? _highTimer;

  // HIGH risk: continuous repeating beep every 1.5s until stopped
  static void playHighAlert() {
    if (_highPlaying) return;
    _highPlaying = true;
    _beep(frequency: 920, duration: 0.35);
    _highTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      if (_highPlaying) _beep(frequency: 920, duration: 0.35);
    });
  }

  // MODERATE risk: single short beep
  static void playModerateAlert() {
    _beep(frequency: 660, duration: 0.25);
  }

  // Call when HIGH alert is acknowledged
  static void stopHighAlert() {
    _highPlaying = false;
    _highTimer?.cancel();
    _highTimer = null;
  }

  static void stopAll() => stopHighAlert();

  static void _beep({double frequency = 880, double duration = 0.3}) {
    try {
      // Create AudioContext lazily using JS interop
      if (_ctx == null) {
        final ctor = js.context['AudioContext'] ?? js.context['webkitAudioContext'];
        if (ctor == null) return;
        _ctx = js.JsObject(ctor as js.JsFunction);
      }

      final osc  = _ctx!.callMethod('createOscillator') as js.JsObject;
      final gain = _ctx!.callMethod('createGain')       as js.JsObject;

      // osc → gain → destination
      osc.callMethod('connect',  [gain]);
      gain.callMethod('connect', [_ctx!['destination']]);

      // Frequency
      (osc['frequency'] as js.JsObject)['value'] = frequency;
      osc['type'] = 'sine';

      // Volume envelope
      final gainParam = gain['gain'] as js.JsObject;
      final now = (_ctx!['currentTime'] as num).toDouble();
      gainParam['value'] = 0.0;
      gainParam.callMethod('linearRampToValueAtTime', [0.22, now + 0.01]);
      gainParam.callMethod('linearRampToValueAtTime', [0.0,  now + duration]);

      osc.callMethod('start', []);
      osc.callMethod('stop',  [now + duration + 0.05]);
    } catch (_) {
      // Silently fail if Web Audio is blocked or unavailable
    }
  }
}
