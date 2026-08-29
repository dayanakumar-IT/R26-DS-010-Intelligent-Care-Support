class ApiConfig {
  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  VIVA DAY — change ONLY this one line                               ║
  // ║  1. Turn on phone hotspot                                           ║
  // ║  2. Connect PC to that hotspot                                      ║
  // ║  3. Run `ipconfig` on PC → IPv4 under Wi-Fi adapter                 ║
  // ║  4. Paste it below, keep :8000                                      ║
  // ║  5. flutter run                                                     ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  static const String baseUrl = 'http://localhost:8000'; // USB: adb reverse tcp:8000 tcp:8000

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
