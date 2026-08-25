import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
              const SizedBox(height: 24),
              Text(auth.caregiverName ?? 'Caregiver', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
              const SizedBox(height: 4),
              Text('Module: SENTRY', style: TextStyle(fontSize: 13, color: AppColors.muted)),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    ref.read(authProvider.notifier).logout();
                    context.go('/auth/login');
                  },
                  child: const Text('Sign Out', style: TextStyle(color: AppColors.high)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
