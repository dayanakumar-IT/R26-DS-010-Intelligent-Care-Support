import 'package:flutter/material.dart';
import 'colors.dart';

enum RiskLevel { high, moderate, low, normal }

class RiskLevelHelper {
  static RiskLevel fromScore(int score) {
    if (score >= 70) return RiskLevel.high;
    if (score >= 40) return RiskLevel.moderate;
    if (score >= 20) return RiskLevel.low;
    return RiskLevel.normal;
  }

  static Color color(RiskLevel level) {
    switch (level) {
      case RiskLevel.high:     return AppColors.high;
      case RiskLevel.moderate: return AppColors.moderate;
      case RiskLevel.low:      return AppColors.low;
      case RiskLevel.normal:   return AppColors.normal;
    }
  }

  static String label(RiskLevel level) {
    switch (level) {
      case RiskLevel.high:     return 'HIGH';
      case RiskLevel.moderate: return 'MOD';
      case RiskLevel.low:      return 'LOW';
      case RiskLevel.normal:   return 'NORMAL';
    }
  }
}
