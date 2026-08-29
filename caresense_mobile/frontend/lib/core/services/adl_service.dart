// ADL Service - Teammate
// Connects to backend endpoints for Activities of Daily Living module.
// Using mock data for now - replace with real Dio calls when backend is ready.

class AdlService {
  // ── MOCK DATA ──────────────────────────────────────────────────────────────

  static List<Map<String, dynamic>> getMockAdlPatients() {
    return [
      {
        'id': 'P001',
        'name': 'Mary Johnson',
        'room': 'R01-Bed1',
        'adlScore': 78,
        'status': 'on_track',       // on_track | partial | refused
        'activitiesCompleted': 5,
        'activitiesTotal': 7,
      },
      {
        'id': 'P002',
        'name': 'James Smith',
        'room': 'R01-Bed2',
        'adlScore': 45,
        'status': 'partial',
        'activitiesCompleted': 3,
        'activitiesTotal': 7,
      },
      {
        'id': 'P003',
        'name': 'Ruth Davis',
        'room': 'R01-Bed3',
        'adlScore': 10,
        'status': 'refused',
        'activitiesCompleted': 1,
        'activitiesTotal': 7,
      },
    ];
  }

  // ── TODO: Real API calls (teammate fills in) ──────────────────────────────
}
