// SENTRY Service — Harishalinee
// Connects to backend endpoints for fall risk detection module.
// Using mock data for now — replace with real Dio calls when backend is ready.

class SentryService {
  // ── MOCK DATA ──────────────────────────────────────────────────────────────

  static List<Map<String, dynamic>> getMockPatients() {
    return [
      {
        'id': 'P001',
        'name': 'Mary Johnson',
        'age': 74,
        'room': 'R01-Bed1',
        'riskScore': 82,
        'riskLevel': 'HIGH',
        'posture': 'Standing',
        'zone': 'Bed Edge',
      },
      {
        'id': 'P002',
        'name': 'James Smith',
        'age': 68,
        'room': 'R01-Bed2',
        'riskScore': 58,
        'riskLevel': 'MODERATE',
        'posture': 'Sitting',
        'zone': 'Chair Zone',
      },
      {
        'id': 'P003',
        'name': 'Ruth Davis',
        'age': 81,
        'room': 'R01-Bed3',
        'riskScore': 25,
        'riskLevel': 'LOW',
        'posture': 'Lying',
        'zone': 'Bed Zone',
      },
    ];
  }

  static List<Map<String, dynamic>> getMockAlerts() {
    return [
      {
        'id': 'A001',
        'patientName': 'Mary Johnson',
        'room': 'R01-Bed1',
        'riskScore': 82,
        'riskLevel': 'HIGH',
        'time': '2 min ago',
        'acknowledged': false,
      },
      {
        'id': 'A002',
        'patientName': 'Thomas Brown',
        'room': 'R02-Bed1',
        'riskScore': 76,
        'riskLevel': 'HIGH',
        'time': '8 min ago',
        'acknowledged': false,
      },
    ];
  }

  static Map<String, dynamic> getMockDashboardSummary() {
    return {
      'totalPatients': 12,
      'highRisk': 2,
      'moderateRisk': 4,
      'lowRisk': 6,
      'alertsToday': 5,
    };
  }

  // ── TODO: Real API calls (uncomment when backend ready) ───────────────────

  // static Future<List<Patient>> getPatients(String token) async {
  //   final dio = Dio();
  //   final response = await dio.get(
  //     '${ApiConfig.baseUrl}${ApiConfig.patients}',
  //     options: Options(headers: {'Authorization': 'Bearer $token'}),
  //   );
  //   return (response.data as List).map((e) => Patient.fromJson(e)).toList();
  // }
}
