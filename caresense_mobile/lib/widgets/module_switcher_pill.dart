import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/constants/colors.dart';
import '../store/module_store.dart';
import 'module_switcher_sheet.dart';

class ModuleSwitcherPill extends ConsumerWidget {
  const ModuleSwitcherPill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = ref.watch(moduleProvider);
    final isSentry = module == ActiveModule.sentry;

    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (_) => const ModuleSwitcherSheet(),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: (isSentry ? AppColors.accent : AppColors.adlGreen).withOpacity(0.15),
          border: Border.all(color: isSentry ? AppColors.accent : AppColors.adlGreen),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(isSentry ? '🛡' : '🏃', style: const TextStyle(fontSize: 13)),
          const SizedBox(width: 4),
          Text(isSentry ? 'SENTRY' : 'ADL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isSentry ? AppColors.accent : AppColors.adlGreen)),
          const SizedBox(width: 2),
          Icon(Icons.keyboard_arrow_down, size: 14, color: isSentry ? AppColors.accent : AppColors.adlGreen),
        ]),
      ),
    );
  }
}
