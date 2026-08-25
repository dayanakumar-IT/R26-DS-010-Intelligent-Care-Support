import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/adl_service.dart';
import '../../widgets/module_switcher_pill.dart';

// TODO: Teammate builds this screen
class AdlHomeScreen extends StatelessWidget {
  const AdlHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final patients = AdlService.getMockAdlPatients();
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Good Morning, Sarah', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
                  Text('ADL Module', style: TextStyle(fontSize: 11, color: AppColors.adlGreen)),
                ]),
                const ModuleSwitcherPill(),
              ]),
            ),
            const Expanded(child: Center(child: Text('ADL Home — Build your screens here 🏃', style: TextStyle(color: AppColors.muted)))),
          ],
        ),
      ),
    );
  }
}
