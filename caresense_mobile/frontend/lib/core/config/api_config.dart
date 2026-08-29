class ApiConfig {
  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  VIVA DAY — change ONLY this one line                               ║
  // ║  1. Turn on phone hotspot                                           ║
  // ║  2. Connect PC to that hotspot                                      ║
  // ║  3. Run `ipconfig` on PC → IPv4 under Wi-Fi adapter                 ║
  // ║  4. Paste it below, keep :8000                                      ║
  // ║  5. flutter run                                                     ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  // WiFi hotspot: connect laptop to phone hotspot → run ipconfig → paste IPv4 here
  // Android hotspot usually gives laptop an IP like 192.168.43.x
  static const String baseUrl = 'http://192.168.43.100:8000'; // ← run ipconfig on viva day, update this

  static const Duration timeout = Duration(seconds: 10);

  // Endpoints — SENTRY
  static const String patients        = '/api/patients';
  static const String alerts          = '/api/alerts';
  static const String dashboardSummary= '/api/dashboard/summary';
  static String patientHistory(String id) => '/api/patients/$id/history';
  static String alertAcknowledge(String id) => '/api/alerts/$id/acknowledge';
  static String eventReplay(String alertId) => '/api/events/$alertId/replay';
  static String liveStream(String roomId) => '/ws/live/$roomId';

  // Endpoints — ADL (teammate fills these in)
  // static const String adlPatients = '/api/adl/patients';
}
