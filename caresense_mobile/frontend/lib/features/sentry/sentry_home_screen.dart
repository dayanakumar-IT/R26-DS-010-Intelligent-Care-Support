import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../store/auth_store.dart';
import '../../widgets/module_switcher_pill.dart';

class SentryHomeScreen extends ConsumerWidget {
  const SentryHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {},
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 12),
                // ── Top bar ──────────────────────────────────────────────
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Good Morning,',
                        style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
                    Text(auth.caregiverName ?? 'Caregiver',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
                  ]),
                  Row(children: [
                    Stack(children: [
                      const Icon(Icons.notifications_outlined, color: AppColors.mutedLight, size: 24),
                      Positioned(top: 0, right: 0,
                        child: Container(width: 8, height: 8,
                            decoration: const BoxDecoration(color: AppColors.high, shape: BoxShape.circle))),
                    ]),
                    const SizedBox(width: 12),
                    const ModuleSwitcherPill(),
                  ]),
                ]),
                const SizedBox(height: 4),
                Text('SENTRY · Shift Active',
                    style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),

                // ── Stat cards — built from alerts + patients ─────────────
                FutureBuilder<List<dynamic>>(
                  future: Future.wait([
                    SentryService.getAlerts(unackedOnly: false),
                    SentryService.getDashboardSummary(),
                  ]),
                  builder: (context, snap) {
                    final alerts = (snap.data?[0] as List<Map<String,dynamic>>?) ?? [];
                    final summary = (snap.data?[1] as Map<String,dynamic>?) ?? {};
                    final total  = summary['total_patients'] ?? 0;
                    // Count unacknowledged alerts by risk level — what the caregiver needs to act on
                    final unacked = alerts.where((a) => a['acknowledged_at'] == null).toList();
                    final high = unacked.where((a) => a['risk_level'] == 'HIGH').length;
                    final mod  = unacked.where((a) => a['risk_level'] == 'MODERATE').length;
                    final low  = unacked.where((a) => a['risk_level'] == 'NORMAL').length;
                    return Column(children: [
                      Row(children: [
                        _StatCard('High Risk',  high.toString(), 'Unacknowledged', AppColors.high),
                        const SizedBox(width: 8),
                        _StatCard('Moderate',   mod.toString(),  'Unacknowledged', AppColors.moderate),
                      ]),
                      const SizedBox(height: 8),
                      Row(children: [
                        _StatCard('Low Risk',   low.toString(),   'Unacknowledged', AppColors.low),
                        const SizedBox(width: 8),
                        _StatCard('Monitored',  total.toString(), 'Total',          AppColors.primary),
                      ]),
                    ]);
                  },
                ),
                const SizedBox(height: 20),

                // ── Recent alerts ────────────────────────────────────────
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('Recent Alerts',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                  Text('View All', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
                ]),
                const SizedBox(height: 10),
                FutureBuilder<List<Map<String, dynamic>>>(
                  future: SentryService.getAlerts(unackedOnly: false),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                    }
                    final alerts = (snap.data ?? []).take(5).toList();
                    if (alerts.isEmpty) {
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.borderLight),
                        ),
                        child: Row(children: [
                          const Text('✅', style: TextStyle(fontSize: 20)),
                          const SizedBox(width: 12),
                          Text('No recent alerts — all clear!',
                              style: TextStyle(fontSize: 13, color: AppColors.mutedLight)),
                        ]),
                      );
                    }
                    return Column(
                      children: alerts.map((a) => _AlertRow(a)).toList(),
                    );
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

class _StatCard extends StatelessWidget {
  final String label, value, sub;
  final Color color;
  const _StatCard(this.label, this.value, this.sub, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 8, height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: color)),
        Text(sub, style: TextStyle(fontSize: 10, color: AppColors.mutedLight)),
      ]),
    ));
  }
}

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
    final timeStr = time.length >= 16 ? time.substring(11, 16) : '—';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        border: Border(left: BorderSide(color: color, width: 3)),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4)],
      ),
      child: Row(children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Room ${a['room_id'] ?? '—'} · Patient ${a['patient_id'] ?? '—'}',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textLight)),
          Text(level == 'HIGH' ? 'High risk · Immediate'
             : level == 'MODERATE' ? 'Unstable movement' : 'Stable',
              style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
          child: Text(level == 'MODERATE' ? 'MOD' : level,
              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 8),
        Text(timeStr, style: TextStyle(fontSize: 10, color: AppColors.dimLight)),
      ]),
    );
  }
}
