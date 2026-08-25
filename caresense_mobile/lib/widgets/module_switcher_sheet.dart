import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/constants/colors.dart';
import '../store/module_store.dart';

class ModuleSwitcherSheet extends ConsumerWidget {
  const ModuleSwitcherSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(moduleProvider);

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1A2235),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('Switch Module', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 16),
          _ModuleRow(
            emoji: '🛡', title: 'SENTRY', subtitle: 'Fall Risk Detection',
            color: AppColors.accent,
            isActive: active == ActiveModule.sentry,
            onTap: () {
              ref.read(moduleProvider.notifier).switchTo(ActiveModule.sentry);
              Navigator.pop(context);
              context.go('/sentry');
            },
          ),
          const SizedBox(height: 10),
          _ModuleRow(
            emoji: '🏃', title: 'ADL', subtitle: 'Activities of Daily Living',
            color: AppColors.adlGreen,
            isActive: active == ActiveModule.adl,
            onTap: () {
              ref.read(moduleProvider.notifier).switchTo(ActiveModule.adl);
              Navigator.pop(context);
              context.go('/adl');
            },
          ),
        ],
      ),
    );
  }
}

class _ModuleRow extends StatelessWidget {
  final String emoji, title, subtitle;
  final Color color;
  final bool isActive;
  final VoidCallback onTap;
  const _ModuleRow({required this.emoji, required this.title, required this.subtitle, required this.color, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          border: Border.all(color: isActive ? color : color.withOpacity(0.3), width: isActive ? 2 : 1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          Text(emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
            Text(subtitle, style: TextStyle(fontSize: 11, color: AppColors.muted)),
          ])),
          if (isActive)
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(10)), child: Text('Active', style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)))
          else
            Text('Switch →', style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}
