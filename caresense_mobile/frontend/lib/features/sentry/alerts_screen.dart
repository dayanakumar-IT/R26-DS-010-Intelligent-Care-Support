import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../widgets/module_switcher_pill.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alerts = SentryService.getMockAlerts();
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
                  Text(' unacknowledged', style: TextStyle(fontSize: 11, color: AppColors.high)),
                ]),
                const ModuleSwitcherPill(),
              ]),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: alerts.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final a = alerts[i];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      border: Border.all(color: AppColors.high.withValues(alpha: 0.4)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      const Text('??', style: TextStyle(fontSize: 22)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(a['patientName'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                        Text(' · Score: ', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
                        Text(a['time'], style: TextStyle(fontSize: 10, color: AppColors.dimLight)),
                      ])),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.high, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                        onPressed: () {},
                        child: const Text('ACK', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                      ),
                    ]),
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

