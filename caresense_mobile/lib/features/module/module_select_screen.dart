import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/module_store.dart';

class ModuleSelectScreen extends ConsumerWidget {
  const ModuleSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('CareSense', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.accentLight)),
              const SizedBox(height: 8),
              const Text('Choose Module', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.text)),
              Text('Your accessible modules', style: TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 24),
              // SENTRY
              _ModuleCard(
                emoji: '🛡',
                title: 'SENTRY',
                subtitle: 'Fall Risk Detection',
                detail: '● 2 high alerts active',
                color: AppColors.accent,
                bg: AppColors.accentBg,
                onTap: () {
                  ref.read(moduleProvider.notifier).switchTo(ActiveModule.sentry);
                  context.go('/sentry');
                },
              ),
              const SizedBox(height: 12),
              // ADL
              _ModuleCard(
                emoji: '🏃',
                title: 'ADL',
                subtitle: 'Activities of Daily Living',
                detail: '● 6 patients active',
                color: AppColors.adlGreen,
                bg: AppColors.adlBg,
                onTap: () {
                  ref.read(moduleProvider.notifier).switchTo(ActiveModule.adl);
                  context.go('/adl');
                },
              ),
              const SizedBox(height: 24),
              // Locked
              Opacity(
                opacity: 0.4,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(children: [
                    const Text('🔒', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: 10),
                    Text('Components 3 & 4 — No access assigned', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  final String emoji, title, subtitle, detail;
  final Color color, bg;
  final VoidCallback onTap;

  const _ModuleCard({required this.emoji, required this.title, required this.subtitle, required this.detail, required this.color, required this.bg, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: color, width: 2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
              Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.text)),
              const SizedBox(height: 2),
              Text(detail, style: TextStyle(fontSize: 11, color: AppColors.muted)),
            ])),
            Icon(Icons.arrow_forward_ios, color: color, size: 16),
          ],
        ),
      ),
    );
  }
}
