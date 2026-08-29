import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class ScribeAlertsScreen extends StatelessWidget {
  const ScribeAlertsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bgLight,
    body: const Center(child: Text('SCRIBE Alerts - Teammate builds here',
      style: TextStyle(color: AppColors.mutedLight))));
}
