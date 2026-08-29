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
  late Future<List<Map<String, dynamic>>> _alertsFuture;

  @override
  void initState() {
    super.initState();
    _alertsFuture = SentryService.getAlerts(unackedOnly: false);
  }

  void _refresh() {
    setState(() {
      _alertsFuture = SentryService.getAlerts(unackedOnly: false);
    });
  }

  Future<void> _acknowledge(dynamic alertId) async {
    if (alertId == null) return;
    await SentryService.acknowledgeAlert(alertId as int);
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Alerts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
                  Text('Fall risk alerts', style: TextStyle(fontSize: 11, color: AppColors.high)),
                ]),
                Row(children: [
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    color: AppColors.mutedLight,
                    onPressed: _refresh,
                  ),
                  const ModuleSwitcherPill(),
                ]),
              ]),
            ),
            Expanded(
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: _alertsFuture,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: AppColors.high));
                  }
                  final alerts = snap.data ?? [];
                  if (alerts.isEmpty) {
                    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('✅', style: TextStyle(fontSize: 36)),
                      const SizedBox(height: 8),
                      Text('No alerts — all clear!',
                          style: TextStyle(color: AppColors.mutedLight, fontSize: 13)),
                    ]));
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: alerts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final a = alerts[i];
                      final isAcked = a['acknowledged_at'] != null;
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          border: Border.all(
                            color: isAcked
                                ? AppColors.borderLight
                                : AppColors.high.withValues(alpha: 0.4),
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(children: [
                          Text(isAcked ? '✅' : '🚨', style: const TextStyle(fontSize: 22)),
                          const SizedBox(width: 12),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(
                              'Patient ${a['patient_code'] ?? a['patient_id'] ?? '—'}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight),
                            ),
                            Text(
                              'Room ${a['room_id'] ?? '—'} · Score: ${(a['risk_score'] ?? 0.0).toStringAsFixed(2)}',
                              style: TextStyle(fontSize: 11, color: AppColors.mutedLight),
                            ),
                            Text(
                              a['created_at']?.toString().substring(0, 16) ?? '',
                              style: TextStyle(fontSize: 10, color: AppColors.dimLight),
                            ),
                          ])),
                          if (!isAcked)
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.high,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              ),
                              onPressed: () => _acknowledge(a['id']),
                              child: const Text('ACK',
                                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                            )
                          else
                            Text('Acked', style: TextStyle(fontSize: 10, color: AppColors.mutedLight)),
                        ]),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
