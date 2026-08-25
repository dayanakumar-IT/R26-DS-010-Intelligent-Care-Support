import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class ScribeProfileScreen extends StatelessWidget {
  const ScribeProfileScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bgLight,
    body: const Center(child: Text('SCRIBE Profile — Teammate builds here',
      style: TextStyle(color: AppColors.mutedLight))));
}
