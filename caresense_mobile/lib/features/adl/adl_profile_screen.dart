import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

// TODO: Teammate builds this screen
class AdlProfileScreen extends StatelessWidget {
  const AdlProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: const Center(child: Text('ADL Profile — TODO', style: TextStyle(color: AppColors.muted))),
    );
  }
}
