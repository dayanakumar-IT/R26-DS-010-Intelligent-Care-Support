import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class PatientDetailScreen extends StatelessWidget {
  final String patientId;
  const PatientDetailScreen({super.key, required this.patientId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(backgroundColor: AppColors.surfaceLight, foregroundColor: AppColors.textLight, title: const Text('Patient Detail')),
      body: const Center(child: Text('Patient detail — TODO', style: TextStyle(color: AppColors.mutedLight))),
    );
  }
}

