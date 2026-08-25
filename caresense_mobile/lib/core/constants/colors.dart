import 'package:flutter/material.dart';

class AppColors {
  // Base
  static const Color background = Color(0xFF060D1A);
  static const Color surface    = Color(0xFF0D1B2E);
  static const Color card       = Color(0xFF111827);
  static const Color border     = Color(0xFF1E2D45);

  // Text
  static const Color text       = Color(0xFFE2E8F0);
  static const Color muted      = Color(0xFF64748B);
  static const Color dim        = Color(0xFF334155);

  // Accent (blue — SENTRY)
  static const Color accent     = Color(0xFF3B82F6);
  static const Color accentLight= Color(0xFF60A5FA);

  // Risk levels
  static const Color high       = Color(0xFFEF4444);   // RED
  static const Color moderate   = Color(0xFFF59E0B);   // AMBER
  static const Color low        = Color(0xFF22C55E);   // GREEN
  static const Color normal     = Color(0xFF64748B);   // GREY

  // ADL module
  static const Color adlGreen   = Color(0xFF34D399);

  // Status backgrounds (low opacity)
  static Color highBg     = high.withOpacity(0.1);
  static Color moderateBg = moderate.withOpacity(0.1);
  static Color lowBg      = low.withOpacity(0.1);
  static Color accentBg   = accent.withOpacity(0.1);
  static Color adlBg      = adlGreen.withOpacity(0.08);
}
