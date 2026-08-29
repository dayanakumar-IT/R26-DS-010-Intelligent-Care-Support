import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../store/auth_store.dart';
import '../../widgets/module_switcher_pill.dart';

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

/// Look up which room_codes are assigned to the logged-in caregiver.
/// Matches profiles.name -> caregiver_profiles.display_name -> rooms.caregiver_id.
/// Returns null if lookup fails (caller should show all rooms as fallback).
Future<Set<String>?> _getMyRoomCodes() async {
  try {
    final db = Supabase.instance.client;
    final authId = db.auth.currentUser?.id;
    if (authId == null) return null;

    final profile = await db.from('profiles').select('name').eq('id', authId).maybeSingle();
    final name = profile?['name']?.toString();
    if (name == null || name.isEmpty) return null;

    final cgRes = await db.from('caregiver_profiles').select('id')
        .ilike('display_name', '%$name%').limit(1).maybeSingle();
    final cgId = cgRes?['id']?.toString();
    if (cgId == null) return null;

    final roomsRes = await db.from('rooms').select('room_code').eq('caregiver_id', cgId);
    final codes = (roomsRes as List).map((r) => r['room_code'].toString()).toSet();
    return codes.isEmpty ? null : codes;
  } catch (_) {
    return null;
  }
}

class SentryHomeScreen extends ConsumerWidget {
  const SentryHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.accentBlue,
          backgroundColor: _surface,
          onRefresh: () async {},
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 14),

                // -"" Top bar -""""""""""""""""""""""""""""""""""""""""""""""
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Good Morning,',
                        style: TextStyle(fontSize: 12, color: _muted)),
                    Text(auth.caregiverName ?? 'Caregiver',
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800, color: _text)),
                  ]),
                  Row(children: [
                    Stack(children: [
                      const Icon(Icons.notifications_outlined, color: _muted, size: 26),
                      Positioned(top: 2, right: 2,
                        child: Container(width: 8, height: 8,
                            decoration: const BoxDecoration(
                                color: AppColors.high, shape: BoxShape.circle))),
                    ]),
                    const SizedBox(width: 12),
                    const ModuleSwitcherPill(),
                  ]),
                ]),
                const SizedBox(height: 4),
                Row(children: [
                  Container(width: 6, height: 6,
                      decoration: const BoxDecoration(color: AppColors.low, shape: BoxShape.circle)),
                  const SizedBox(width: 5),
                  Text('SENTRY -- Shift Active',
                      style: TextStyle(fontSize: 11, color: AppColors.low, fontWeight: FontWeight.w600)),
                ]),
                const SizedBox(height: 18),

                // -"" Stat cards -"""""""""""""""""""""""""""""""""""""""""""
                Text('Your Assigned Patients',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _muted)),
                const SizedBox(height: 10),
                FutureBuilder<List<dynamic>>(
                  future: Future.wait([
                    SentryService.getAlerts(unackedOnly: false),
                    SentryService.getDashboardSummary(),
                  ]),
                  builder: (context, snap) {
                    final alerts = (snap.data?[0] as List<Map<String, dynamic>>?) ?? [];
                    final summary = (snap.data?[1] as Map<String, dynamic>?) ?? {};
                    final total  = summary['total_patients'] ?? 0;
                    final unacked = alerts.where((a) => a['acknowledged_at'] == null).toList();
                    final high = unacked.where((a) => a['risk_level'] == 'HIGH').length;
                    final mod  = unacked.where((a) => a['risk_level'] == 'MODERATE').length;
                    final low  = unacked.where((a) => a['risk_level'] == 'NORMAL').length;
                    return Column(children: [
                      Row(children: [
                        _StatCard('High Risk',  high.toString(),  'Unacknowledged', AppColors.high),
                        const SizedBox(width: 10),
                        _StatCard('Moderate',   mod.toString(),   'Unacknowledged', AppColors.moderate),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        _StatCard('Low Risk',   low.toString(),   'Active',         AppColors.low),
                        const SizedBox(width: 10),
                        _StatCard('Monitored',  total.toString(), 'Total patients', AppColors.accentBlue),
                      ]),
                    ]);
                  },
                ),
                const SizedBox(height: 22),

                // -"" Recent alerts -""""""""""""""""""""""""""""""""""""""""
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('Recent Alerts',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _text)),
                  Text('View All ->',
                      style: TextStyle(fontSize: 11, color: AppColors.accentBlue, fontWeight: FontWeight.w600)),
                ]),
                const SizedBox(height: 10),
                FutureBuilder<List<dynamic>>(
                  future: Future.wait([
                    SentryService.getAlerts(unackedOnly: false),
                    _getMyRoomCodes(),
                  ]),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const Center(
                          child: CircularProgressIndicator(color: AppColors.high, strokeWidth: 2));
                    }
                    final allAlerts = (snap.data?[0] as List<Map<String, dynamic>>?) ?? [];
                    final myRooms  = snap.data?[1] as Set<String>?;
                    // Filter by caregiver's rooms if known; otherwise show all
                    final filtered = myRooms != null
                        ? allAlerts.where((a) => myRooms.contains(a['room_id']?.toString())).toList()
                        : allAlerts;
                    final alerts = filtered
                        .where((a) => a['acknowledged_at'] == null)
                        .take(5)
                        .toList();
                    if (alerts.isEmpty) {
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: _surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _border),
                        ),
                        child: Row(children: [
                          const Text('-...', style: TextStyle(fontSize: 20)),
                          const SizedBox(width: 12),
                          Text('No active alerts -- all clear!',
                              style: TextStyle(fontSize: 13, color: _muted)),
                        ]),
                      );
                    }
                    return Column(children: alerts.map((a) => _AlertRow(a)).toList());
                  },
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// -"" Stat card -""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
class _StatCard extends StatelessWidget {
  final String label, value, sub;
  final Color color;
  const _StatCard(this.label, this.value, this.sub, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 7, height: 7,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 6),
        Text(value,
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: color)),
        Text(sub, style: TextStyle(fontSize: 10, color: _muted)),
      ]),
    ));
  }
}

// -"" Alert row -""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
class _AlertRow extends StatelessWidget {
  final Map<String, dynamic> a;
  const _AlertRow(this.a);

  @override
  Widget build(BuildContext context) {
    final level = (a['risk_level'] ?? 'NORMAL').toString();
    final color = level == 'HIGH' ? AppColors.high
                : level == 'MODERATE' ? AppColors.moderate
                : AppColors.low;
    final icon  = level == 'HIGH' ? Icons.warning_rounded
                : level == 'MODERATE' ? Icons.warning_amber_rounded
                : Icons.check_circle_outline;
    final time  = (a['created_at'] ?? '').toString();
    final timeStr = time.length >= 16 ? time.substring(11, 16) : '-"';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(8),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(children: [
          // Left accent stripe
          Container(width: 4, color: color),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              child: Row(children: [
                Icon(icon, color: color, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Room ${a['room_id'] ?? '--'} - Patient ${a['patient_id'] ?? '--'}',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: _text)),
                  Text(level == 'HIGH' ? 'High risk - Immediate'
                     : level == 'MODERATE' ? 'Unstable movement' : 'Stable',
                      style: TextStyle(fontSize: 11, color: _muted)),
                ])),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
                  child: Text(level == 'MODERATE' ? 'MOD' : level,
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 8),
                Text(timeStr, style: TextStyle(fontSize: 10, color: _dim)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
