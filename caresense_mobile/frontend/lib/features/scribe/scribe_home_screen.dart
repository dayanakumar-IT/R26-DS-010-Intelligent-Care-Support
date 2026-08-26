import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../widgets/module_switcher_pill.dart';

class ScribeHomeScreen extends StatelessWidget {
  const ScribeHomeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(child: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('SCRIBE', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.scribe)),
              Text('Voice to ADL Documentation', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
            ]),
            const ModuleSwitcherPill(),
          ]),
        ),
        Expanded(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🎤', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          const Text('SCRIBE Home', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textLight)),
          Text('Teammate builds ADL screens here', style: TextStyle(fontSize: 13, color: AppColors.mutedLight)),
        ]))),
      ])),
    );
  }
}
