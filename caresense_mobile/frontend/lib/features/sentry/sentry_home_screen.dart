import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../widgets/risk_badge.dart';
import '../../widgets/module_switcher_pill.dart';

class SentryHomeScreen extends StatelessWidget {
  const SentryHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final summary = SentryService.getMockDashboardSummary();
    final patients = SentryService.getMockPatients();

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Good Morning, Sarah', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                    Text('SENTRY · Shift Active', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
                  ]),
                  const ModuleSwitcherPill(),
                ],
              ),
            ),
            // Stat cards
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                _StatCard('High Risk', summary['highRisk'].toString(), AppColors.high),
                const SizedBox(width: 8),
                _StatCard('Moderate', summary['moderateRisk'].toString(), AppColors.moderate),
                const SizedBox(width: 8),
                _StatCard('Low Risk', summary['lowRisk'].toString(), AppColors.low),
              ]),
            ),
            const SizedBox(height: 16),
            // Patient list
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Your Patients', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                Text(' assigned', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
              ]),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: patients.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = patients[i];
                  return _PatientRow(p);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final Color color;
  const _StatCard(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.mutedLight)),
      ]),
    ));
  }
}

class _PatientRow extends StatelessWidget {
  final Map<String, dynamic> p;
  const _PatientRow(this.p);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(p['name'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
          const SizedBox(height: 2),
          Text(' · ', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
        ])),
        RiskBadge(level: p['riskLevel'], score: p['riskScore']),
      ]),
    );
  }
}

