import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'sound_service.dart';

/// Connects to /ws/alerts and plays sounds for incoming high-risk alerts.
/// Call [AlertWsService.start] once in main() after Supabase init.
class AlertWsService {
  static WebSocketChannel? _channel;
  static Timer? _reconnectTimer;
  static String? _baseUrl;

  static void start(String baseUrl) {
    _baseUrl = baseUrl;
    _connect();
  }

  static void _connect() {
    if (_baseUrl == null) return;
    try {
      final wsUrl = _baseUrl!
          .replaceFirst('http://', 'ws://')
          .replaceFirst('https://', 'wss://');
      _channel = WebSocketChannel.connect(Uri.parse('$wsUrl/ws/alerts'));
      _channel!.stream.listen(
        (raw) {
          try {
            final data = jsonDecode(raw as String) as Map<String, dynamic>;
            final level = (data['risk_level'] ?? '').toString();
            if (level == 'HIGH') {
              SoundService.playHighAlert();
            } else if (level == 'MODERATE') {
              SoundService.playModerateAlert();
            }
          } catch (_) {}
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  static void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), _connect);
  }

  static void dispose() {
    _channel?.sink.close();
    _reconnectTimer?.cancel();
    SoundService.stopAll();
  }
}
