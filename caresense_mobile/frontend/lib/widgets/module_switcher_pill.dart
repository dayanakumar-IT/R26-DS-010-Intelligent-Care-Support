import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/constants/colors.dart';
import '../store/module_store.dart';
import 'module_switcher_sheet.dart';

class ModuleSwitcherPill extends ConsumerWidget {
  /// Set [onDark] to true when the pill sits on a dark/gradient background
  final bool onDark;
  const ModuleSwitcherPill({super.key, this.onDark = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module   = ref.watch(moduleProvider);
    final isSentry = module == ActiveModule.sentry;
    final color    = isSentry ? AppColors.sentry : AppColors.scribe;
    final icon     = isSentry ? Icons.shield_rounded : Icons.mic_rounded;
    final label    = isSentry ? 'SENTRY' : 'SCRIBE';

    // On dark hero background — use white styling
    final pillColor  = onDark ? Colors.white.withValues(alpha: 0.18) : color.withValues(alpha: 0.1);
    final borderCol  = onDark ? Colors.white.withValues(alpha: 0.35) : color.withValues(alpha: 0.3);
    final textColor  = onDark ? Colors.white : color;

    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        builder: (_) => const ModuleSwitcherSheet(),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: pillColor,
          border: Border.all(color: borderCol),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: textColor),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                  color: textColor)),
          const SizedBox(width: 3),
          Icon(Icons.keyboard_arrow_down_rounded, size: 14, color: textColor),
        ]),
      ),
    );
  }
}
