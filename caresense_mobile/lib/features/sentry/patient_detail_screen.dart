import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class PatientDetailScreen extends StatelessWidget {
  final String patientId;
  const PatientDetailScreen({super.key, required this.patientId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, foregroundColor: AppColors.text, title: const Text('Patient Detail')),
      body: const Center(child: Text('Patient detail — TODO', style: TextStyle(color: AppColors.muted))),
    );
  }
}
