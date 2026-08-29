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
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Hi, ${auth.caregiverName ?? 'Caregiver'}',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                    Text('SENTRY · Shift Active',
                        style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
                  ]),
                  const ModuleSwitcherPill(),
                ],
              ),
            ),

            // Dashboard summary
            FutureBuilder<Map<String, dynamic>>(
              future: SentryService.getDashboardSummary(),
              builder: (context, snap) {
                final summary = snap.data ?? {};
                final byLevel = summary['patients_by_level'] as Map? ?? {};
                final high = (byLevel['HIGH']     ?? 0).toString();
                final mod  = (byLevel['MODERATE'] ?? 0).toString();
                final low  = (byLevel['NORMAL']   ?? 0).toString();
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(children: [
                    _StatCard('High Risk', high, AppColors.high),
                    const SizedBox(width: 8),
                    _StatCard('Moderate',  mod,  AppColors.moderate),
                    const SizedBox(width: 8),
                    _StatCard('Low Risk',  low,  AppColors.low),
                  ]),
                );
              },
            ),
            const SizedBox(height: 16),

            // Patient list header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Your Patients',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                Text('assigned rooms', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
              ]),
            ),
            const SizedBox(height: 8),

            // Patient list
            Expanded(
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: SentryService.getPatients(caregiverId: auth.caregiverId),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                  }
                  final patients = snap.data ?? [];
                  if (patients.isEmpty) {
                    return Center(child: Text('No patients assigned.',
                        style: TextStyle(color: AppColors.mutedLight, fontSize: 13)));
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: patients.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _PatientRow(patients[i]),
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
          Text(p['patient_code'] ?? '—',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
          const SizedBox(height: 2),
          Text('Room ${p['room_id'] ?? '—'} · ${p['gender'] ?? '—'}',
              style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text('Monitoring', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
        ),
      ]),
    );
  }
}
