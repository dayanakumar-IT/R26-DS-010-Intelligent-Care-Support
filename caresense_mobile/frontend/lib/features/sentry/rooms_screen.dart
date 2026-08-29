import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../store/auth_store.dart';
import '../../widgets/module_switcher_pill.dart';

class RoomsScreen extends ConsumerWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Rooms', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
                const ModuleSwitcherPill(),
              ]),
            ),
            Expanded(
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: SentryService.getPatients(caregiverId: auth.caregiverId),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                  }
                  final patients = snap.data ?? [];
                  if (patients.isEmpty) {
                    return Center(child: Text('No rooms assigned.',
                        style: TextStyle(color: AppColors.mutedLight, fontSize: 13)));
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: patients.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final p = patients[i];
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          border: Border.all(color: AppColors.borderLight),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(children: [
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Room ${p['room_id'] ?? '—'}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                            const SizedBox(height: 2),
                            Text(p['patient_code'] ?? '—',
                                style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
                            Text(p['gender'] ?? '—',
                                style: TextStyle(fontSize: 10, color: AppColors.dimLight)),
                          ])),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('Live', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
                          ),
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
