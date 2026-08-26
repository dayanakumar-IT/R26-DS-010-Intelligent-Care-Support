import 'package:flutter/material.dart';
import '../core/constants/colors.dart';

class RiskBadge extends StatelessWidget {
  final String level;
  final int score;
  const RiskBadge({super.key, required this.level, required this.score});

  Color get _color {
    switch (level) {
      case 'HIGH':     return AppColors.high;
      case 'MODERATE': return AppColors.moderate;
      case 'LOW':      return AppColors.low;
      default:         return AppColors.normal;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        border: Border.all(color: _color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(' ', style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}
