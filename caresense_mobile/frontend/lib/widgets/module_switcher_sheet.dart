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
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 40, height: 4,
            decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text('Switch Module',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Your assigned modules',
              style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
          ),
          const SizedBox(height: 20),
          _ModuleRow(
            emoji: 'ame: 'SENTRY', sub: 'Fall Risk Detection',
            color: AppColors.sentry,
            isActive: active == ActiveModule.sentry,
            onTap: () {
              ref.read(moduleProvider.notifier).switchTo(ActiveModule.sentry);
              Navigator.pop(context);
              context.go('/sentry');
            },
          ),
          const SizedBox(height: 12),
          _ModuleRow(
            emoji: 'ame: 'SCRIBE', sub: 'Voice to ADL Documentation',
            color: AppColors.scribe,
            isActive: active == ActiveModule.scribe,
            onTap: () {
              ref.read(moduleProvider.notifier).switchTo(ActiveModule.scribe);
              Navigator.pop(context);
              context.go('/scribe');
            },
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.bgLight,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Row(children: [
              const Text('tyle: TextStyle(fontSize: 14)),
              const SizedBox(width: 8),
              Text('PULSE & GLOSS â€" Not assigned to you',
                style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
            ]),
          ),
        ],
      ),
    );
  }
}

class _ModuleRow extends StatelessWidget {
  final String emoji, name, sub;
  final Color color;
  final bool isActive;
  final VoidCallback onTap;
  const _ModuleRow({required this.emoji, required this.name, required this.sub,
    required this.color, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isActive ? color.withOpacity(0.06) : AppColors.bgLight,
          border: Border.all(
            color: isActive ? color : AppColors.borderLight,
            width: isActive ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(child: Text(emoji, style: const TextStyle(fontSize: 22))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
            Text(sub, style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
          ])),
          if (isActive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('Active', style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)),
            )
          else
            Row(mainAxisSize: MainAxisSize.min, children: [
              Text('Switch', style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
              const SizedBox(width: 2),
              Icon(Icons.arrow_forward_ios_rounded, size: 10, color: color),
            ]),
        ]),
      ),
    );
  }
}
