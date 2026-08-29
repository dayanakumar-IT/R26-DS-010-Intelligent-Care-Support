class ApiConfig {
  // ── Dev: phone on the same WiFi as your PC ──────────────────────────────
  // Run `ipconfig` on your PC → find IPv4 under your WiFi adapter → put it here.
  // Example: 'http://192.168.1.42:8000'
  // Leave as localhost only when testing on an Android emulator.
  static const String baseUrl = 'http://192.168.8.154:8000';

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
