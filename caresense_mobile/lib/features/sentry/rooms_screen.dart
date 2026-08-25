import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../widgets/risk_badge.dart';
import '../../widgets/module_switcher_pill.dart';

class RoomsScreen extends StatelessWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final patients = SentryService.getMockPatients();
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Rooms', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
                const ModuleSwitcherPill(),
              ]),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: patients.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = patients[i];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.surface, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(p['room'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.text)),
                        const SizedBox(height: 2),
                        Text(p['name'], style: TextStyle(fontSize: 11, color: AppColors.muted)),
                        Text(' · ', style: TextStyle(fontSize: 10, color: AppColors.dim)),
                      ])),
                      RiskBadge(level: p['riskLevel'], score: p['riskScore']),
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
