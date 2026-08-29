import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../widgets/module_switcher_pill.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  String _filter = 'All'; // All | HIGH | MODERATE | NORMAL

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() => setState(() {
    _future = SentryService.getAlerts(unackedOnly: false);
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(children: [
          // ── Header ────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Alerts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
                Text('Fall risk alerts', style: TextStyle(fontSize: 11, color: AppColors.high)),
              ]),
              Row(children: [
                IconButton(icon: const Icon(Icons.refresh_rounded, size: 20), color: AppColors.mutedLight, onPressed: _load),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // ── Filter tabs ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: ['All', 'High', 'Moderate', 'Low'].map((f) {
              final active = _filter == f;
              final color = f == 'High' ? AppColors.high
                          : f == 'Moderate' ? AppColors.moderate
                          : f == 'Low' ? AppColors.low
                          : AppColors.primary;
              return GestureDetector(
                onTap: () => setState(() => _filter = f),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: active ? color : Colors.transparent,
                    border: Border.all(color: active ? color : AppColors.borderLight),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(f, style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600,
                    color: active ? Colors.white : AppColors.mutedLight,
                  )),
                ),
              );
            }).toList()),
          ),
          const SizedBox(height: 12),

          // ── Alert list ────────────────────────────────────────────────
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: AppColors.high));
                }
                var alerts = snap.data ?? [];

                // Apply filter
                if (_filter != 'All') {
                  final lvl = _filter.toUpperCase() == 'LOW' ? 'NORMAL' : _filter.toUpperCase();
                  alerts = alerts.where((a) => (a['risk_level'] ?? '') == lvl).toList();
                }

                if (alerts.isEmpty) {
                  return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Text('✅', style: TextStyle(fontSize: 36)),
                    const SizedBox(height: 8),
                    Text('No alerts — all clear!', style: TextStyle(color: AppColors.mutedLight, fontSize: 13)),
                  ]));
                }

                // Group by today/earlier
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: alerts.length + 1,
                  itemBuilder: (_, i) {
                    if (i == 0) return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text('Today', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.mutedLight)),
                    );
                    return _AlertCard(alerts[i - 1], onAck: _load);
                  },
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final Map<String, dynamic> a;
  final VoidCallback onAck;
  const _AlertCard(this.a, {required this.onAck});

  @override
  Widget build(BuildContext context) {
    final level   = (a['risk_level'] ?? 'NORMAL').toString();
    final isAcked = a['acknowledged_at'] != null;
    final color   = level == 'HIGH' ? AppColors.high
                  : level == 'MODERATE' ? AppColors.moderate
                  : AppColors.low;
    final icon    = level == 'HIGH' ? '🚨' : level == 'MODERATE' ? '⚠️' : '✅';
    final label   = level == 'HIGH' ? 'High risk · Immediate'
                  : level == 'MODERATE' ? 'Unstable movement' : 'Stable';
    final time    = (a['created_at'] ?? '').toString();
    final timeStr = time.length >= 16 ? time.substring(11, 16) : '—';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        border: Border.all(color: isAcked ? AppColors.borderLight : color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(10),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4)],
      ),
      child: Row(children: [
        Text(icon, style: const TextStyle(fontSize: 22)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Room ${a['room_id'] ?? '—'} · Patient ${a['patient_id'] ?? '—'}',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
          Text(label, style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
          Text(timeStr, style: TextStyle(fontSize: 10, color: AppColors.dimLight)),
        ])),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
          child: Text(level == 'MODERATE' ? 'MOD' : level,
              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
        ),
        if (!isAcked) ...[
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () async {
              await SentryService.acknowledgeAlert(a['id'] as int);
              onAck();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.high,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('ACK', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ]),
    );
  }
}
