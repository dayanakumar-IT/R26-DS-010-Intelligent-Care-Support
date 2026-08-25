import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

// TODO: Teammate builds this screen
class TasksScreen extends StatelessWidget {
  const TasksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: const Center(child: Text('ADL Tasks — TODO', style: TextStyle(color: AppColors.muted))),
    );
  }
}
