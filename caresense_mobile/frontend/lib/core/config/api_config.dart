class ApiConfig {
  // TODO: Replace with your deployed backend URL
  // For local dev with ngrok: 'https://xxxx.ngrok.io'
  // For production: 'https://your-backend.com'
  static const String baseUrl = 'http://localhost:8000';

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
