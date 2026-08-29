import 'package:flutter/material.dart';

class AppColors {
  // ── Primary clinical palette — matches web dashboard exactly ─────────────
  static const Color primary      = Color(0xFF1E3A8A); // web: #1e3a8a deep navy
  static const Color primaryLight = Color(0xFF3B82F6); // mid blue
  static const Color primaryDark  = Color(0xFF1E3A8A); // deep navy

  static const Color secondary    = Color(0xFF7C3AED); // vibrant purple (login gradient only)
  static const Color secondaryLight = Color(0xFFA78BFA);

  static const Color teal         = Color(0xFF0891B2); // clinical teal
  static const Color tealLight    = Color(0xFF22D3EE);

  // ── Backgrounds — matches web dashboard ──────────────────────────────────
  static const Color bgLight      = Color(0xFFF8FAFC); // web: #f8fafc
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color cardLight    = Color(0xFFFFFFFF);
  static const Color borderLight  = Color(0xFFE2E8F0); // web: #e2e8f0

  // ── Text — matches web dashboard ─────────────────────────────────────────
  static const Color textLight    = Color(0xFF0F172A); // web: #0f172a
  static const Color mutedLight   = Color(0xFF64748B); // web: #64748b
  static const Color dimLight     = Color(0xFF94A3B8); // web: #94a3b8

  // ── Dark theme ───────────────────────────────────────────────────────────
  static const Color bgDark       = Color(0xFF060D1A);
  static const Color surfaceDark  = Color(0xFF0D1B2E);
  static const Color textDark     = Color(0xFFE2E8F0);
  static const Color mutedDark    = Color(0xFF64748B);

  // ── Module colours ───────────────────────────────────────────────────────
  static const Color pulse        = Color(0xFFDC2626); // vivid red
  static const Color sentry       = Color(0xFF1E3A8A); // web primary navy
  static const Color scribe       = Color(0xFF059669); // vivid green
  static const Color gloss        = Color(0xFFD97706); // amber

  // ── Risk levels — matches web dashboard exactly ───────────────────────────
  static const Color high         = Color(0xFFEF4444); // web: #ef4444
  static const Color moderate     = Color(0xFFF59E0B); // web: #f59e0b
  static const Color low          = Color(0xFF22C55E); // web: #22c55e
  static const Color normal       = Color(0xFF64748B); // web: #64748b

  // ── Gradients ────────────────────────────────────────────────────────────
  static const LinearGradient brandGradient = LinearGradient(
    colors: [Color(0xFF1A56DB), Color(0xFF7C3AED)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient bgGradient = LinearGradient(
    colors: [Color(0xFFF8FAFC), Color(0xFFEFF6FF)], // web: f8fafc light bg
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
  static const LinearGradient sentryGradient = LinearGradient(
    colors: [Color(0xFF1A56DB), Color(0xFF0891B2)],
  );
  static const LinearGradient scribeGradient = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF0891B2)],
  );

  // ── Accent (alias) ───────────────────────────────────────────────────────
  static const Color accent      = primary;
  static const Color accentLight = primaryLight;
  static const Color blueStart   = primary;
  static const Color purpleEnd   = secondary;
}

class AppTheme {
  static ThemeData light() => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.bgLight,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: AppColors.surfaceLight,
    ),
    cardTheme: CardThemeData(
      color: AppColors.cardLight,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderLight),
      ),
    ),
    textTheme: const TextTheme(
      bodyLarge: TextStyle(color: AppColors.textLight),
      bodyMedium: TextStyle(color: AppColors.textLight),
    ),
    fontFamily: 'Roboto',
  );

  static ThemeData dark() => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bgDark,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: AppColors.surfaceDark,
    ),
    fontFamily: 'Roboto',
  );
}
