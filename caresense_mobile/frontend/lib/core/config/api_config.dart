import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const int _port = 8000;
  static const String _prefKey = 'backend_base_url';
  static String _baseUrl = 'http://10.112.110.43:8000';
  static String get baseUrl => _baseUrl;
  static const Duration timeout = Duration(seconds: 10);

  static const String patients         = '/api/patients';
  static const String alerts           = '/api/alerts';
  static const String dashboardSummary = '/api/dashboard/summary';
  static String patientHistory(String id)   => '/api/patients/$id/history';
  static String alertAcknowledge(String id) => '/api/alerts/$id/acknowledge';
  static String eventReplay(String alertId) => '/api/events/$alertId/replay';
  static String liveStream(String roomId)   => '/ws/live/$roomId';

  static Future<void> discoverAndSave() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKey);
    if (saved != null && saved.isNotEmpty) {
      if (await _ping(saved)) { _baseUrl = saved; return; }
    }
    final found = await _discover();
    if (found != null) {
      _baseUrl = found;
      await prefs.setString(_prefKey, found);
      return;
    }
    if (saved != null && saved.isNotEmpty) { _baseUrl = saved; }
  }

  static Future<void> saveManual(String url) async {
    _baseUrl = url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, url);
  }

  static Future<bool> _ping(String base) async {
    try {
      final resp = await http.get(Uri.parse('$base/api/health')).timeout(const Duration(seconds: 2));
      return resp.statusCode == 200;
    } catch (_) { return false; }
  }

  static Future<String?> _discover() async {
    final prefixes = ['192.168.43', '192.168.1', '10.112.110', '10.0.0', '172.20.10'];
    for (final prefix in prefixes) {
      final candidates = [1, 2, 100, 101, 102, 103, 104, 105].map((h) => '$prefix.$h').toList();
      final futures = candidates.map((host) async {
        final url = 'http://$host:$_port';
        if (await _ping(url)) return url;
        return null;
      });
      final results = await Future.wait(futures);
      final found = results.whereType<String>().firstOrNull;
      if (found != null) return found;
    }
    return null;
  }
}
