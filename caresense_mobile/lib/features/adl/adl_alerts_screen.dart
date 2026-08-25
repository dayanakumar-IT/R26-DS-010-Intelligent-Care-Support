import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

// TODO: Teammate builds this screen
class AdlAlertsScreen extends StatelessWidget {
  const AdlAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: const Center(child: Text('ADL Alerts — TODO', style: TextStyle(color: AppColors.muted))),
    );
  }
}
