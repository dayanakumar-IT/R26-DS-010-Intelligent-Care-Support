import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class ScribeTasksScreen extends StatelessWidget {
  const ScribeTasksScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bgLight,
    body: const Center(child: Text('SCRIBE Tasks - Teammate builds here 🎤',
      style: TextStyle(color: AppColors.mutedLight))));
}
