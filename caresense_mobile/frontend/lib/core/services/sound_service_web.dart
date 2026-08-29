// Web Audio API beep generator — works in Chrome without any packages
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:async';

class SoundService {
  static html.AudioContext? _ctx;
  static bool _highPlaying = false;
  static Timer? _highTimer;

  // HIGH risk: continuous repeating beep every 1.5s until stopped
  static void playHighAlert() {
    if (_highPlaying) return; // already running
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

  static void stopAll() {
    stopHighAlert();
  }

  static void _beep({double frequency = 880, double duration = 0.3}) {
    try {
      _ctx ??= html.AudioContext();
      final osc = _ctx!.createOscillator();
      final gain = _ctx!.createGain();
      osc.connectNode(gain);
      gain.connectNode(_ctx!.destination!);

      // Configure oscillator
      final oscJs = osc as dynamic;
      oscJs.frequency.value = frequency;
      oscJs.type = 'sine';

      // Configure gain (volume ramp — prevents click artefacts)
      final gainJs = gain as dynamic;
      gainJs.gain.value = 0.0;
      gainJs.gain.linearRampToValueAtTime(0.25, _ctx!.currentTime! + 0.01);
      gainJs.gain.linearRampToValueAtTime(0.0,  _ctx!.currentTime! + duration);

      osc.start();
      osc.stop(_ctx!.currentTime! + duration + 0.05);
    } catch (_) {
      // Silently fail if AudioContext is not available
    }
  }
}
