import 'package:flutter/material.dart';

class AppColors {
  // ── Brand gradient ──────────────────────────────────────────────────────
  static const Color blueStart   = Color(0xFF60A5FA); // light blue
  static const Color purpleEnd   = Color(0xFFA78BFA); // light purple
  static const LinearGradient brandGradient = LinearGradient(
    colors: [blueStart, purpleEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient brandGradientVertical = LinearGradient(
    colors: [Color(0xFFEFF6FF), Color(0xFFF5F3FF)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ── Light theme ──────────────────────────────────────────────────────────
  static const Color bgLight       = Color(0xFFF0F7FF);
  static const Color surfaceLight  = Color(0xFFFFFFFF);
  static const Color cardLight     = Color(0xFFFFFFFF);
  static const Color borderLight   = Color(0xFFDBEAFE);
  static const Color textLight     = Color(0xFF1E3A5F);
  static const Color mutedLight    = Color(0xFF64748B);
  static const Color dimLight      = Color(0xFF94A3B8);

  // ── Dark theme ───────────────────────────────────────────────────────────
  static const Color bgDark        = Color(0xFF060D1A);
  static const Color surfaceDark   = Color(0xFF0D1B2E);
  static const Color cardDark      = Color(0xFF111827);
  static const Color borderDark    = Color(0xFF1E2D45);
  static const Color textDark      = Color(0xFFE2E8F0);
  static const Color mutedDark     = Color(0xFF64748B);

  // ── Accent (same both themes) ────────────────────────────────────────────
  static const Color accent        = Color(0xFF3B82F6);
  static const Color accentLight   = Color(0xFF60A5FA);
  static const Color purple        = Color(0xFF8B5CF6);
  static const Color purpleLight   = Color(0xFFA78BFA);

  // ── Module colours ───────────────────────────────────────────────────────
  static const Color pulse         = Color(0xFFEF4444); // red — stress
  static const Color sentry        = Color(0xFF3B82F6); // blue — fall risk
  static const Color scribe        = Color(0xFF10B981); // green — voice/ADL
  static const Color gloss         = Color(0xFFF59E0B); // amber — sign lang

  // ── Risk levels ──────────────────────────────────────────────────────────
  static const Color high          = Color(0xFFEF4444);
  static const Color moderate      = Color(0xFFF59E0B);
  static const Color low           = Color(0xFF22C55E);
  static const Color normal        = Color(0xFF64748B);
}

class AppTheme {
  static ThemeData light() => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.bgLight,
    colorScheme: const ColorScheme.light(
      primary: AppColors.accent,
      secondary: AppColors.purple,
      surface: AppColors.surfaceLight,
    ),
    cardTheme: CardTheme(
      color: AppColors.cardLight,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderLight),
      ),
    ),
    fontFamily: 'Roboto',
  );

  static ThemeData dark() => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bgDark,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.accent,
      secondary: AppColors.purple,
      surface: AppColors.surfaceDark,
    ),
    fontFamily: 'Roboto',
  );
}
