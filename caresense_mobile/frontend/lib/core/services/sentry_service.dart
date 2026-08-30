// SENTRY Service - Harishalinee
// Real API calls to the fall-detection backend.

import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/api_config.dart';

class SentryService {
  static SupabaseClient get _supabase => Supabase.instance.client;

  static final Dio _dio = Dio(BaseOptions(
    baseUrl:        ApiConfig.baseUrl,
    connectTimeout: ApiConfig.timeout,
    receiveTimeout: ApiConfig.timeout,
  ));

  // ── Dashboard summary ─────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getDashboardSummary() async {
    try {
      final res = await _dio.get(ApiConfig.dashboardSummary);
      return Map<String, dynamic>.from(res.data as Map);
    } catch (_) {
      return {'highRisk': 0, 'moderateRisk': 0, 'lowRisk': 0,
              'totalPatients': 0, 'alertsToday': 0};
    }
  }

  // ── Patients ──────────────────────────────────────────────────────────────

  /// [caregiverId] = logged-in caregiver's UUID → returns only their patients.
  /// Omit (null) for supervisor/admin → returns all patients.
  static Future<List<Map<String, dynamic>>> getPatients({
    String? caregiverId,
  }) async {
    try {
      final res = await _dio.get(
        ApiConfig.patients,
        queryParameters: caregiverId != null
            ? {'caregiver_id': caregiverId}
            : null,
      );
      final list = res.data as List;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> getPatientHistory(
      String patientId) async {
    try {
      final res = await _dio.get(ApiConfig.patientHistory(patientId));
      final list = res.data as List;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  // ── Alerts ────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getAlerts({
    bool unackedOnly = false,
  }) async {
    try {
      final res = await _dio.get(ApiConfig.alerts,
          queryParameters: {'unacked_only': unackedOnly});
      final list = res.data as List;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<bool> acknowledgeAlert(int alertId) async {
    // Try backend REST first, fall back to direct Supabase update
    try {
      await _dio.patch(
        ApiConfig.alertAcknowledge(alertId.toString()),
        data: {'ack_by': 'caregiver'},
      );
      return true;
    } catch (_) {}
    // Fallback: write directly to Supabase using correct schema field names.
    // fall_alerts schema: acknowledged (bool), ack_by (text), ack_at (timestamptz)
    try {
      await _supabase
          .from('fall_alerts')
          .update({
            'acknowledged': true,
            'ack_by':       'caregiver',
            'ack_at':       DateTime.now().toUtc().toIso8601String(),
          })
          .eq('id', alertId)
          .eq('acknowledged', false);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Event replay ──────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getReplay(int alertId) async {
    try {
      final res = await _dio.get(ApiConfig.eventReplay(alertId.toString()));
      final frames = res.data['frames'] as List;
      return frames.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }
}
