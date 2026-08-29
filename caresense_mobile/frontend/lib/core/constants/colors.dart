import 'package:flutter/material.dart';

class AppColors {
  // ── Primary clinical palette — matches web dashboard exactly ─────────────
  static const Color primary      = Color(0xFF1E3A8A); // web: #1e3a8a deep navy
  static const Color primaryLight = Color(0xFF3B82F6); // mid blue
  static const Color primaryDark  = Color(0xFF1E3A8A); // deep navy

  static const Color secondary    = Color(0xFF7C3AED);
  static const Color secondaryLight = Color(0xFFA78BFA);

  static const Color teal         = Color(0xFF0891B2);
  static const Color tealLight    = Color(0xFF22D3EE);

  // ── Light backgrounds (login screen only) ────────────────────────────────
  static const Color bgLight      = Color(0xFFF8FAFC);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color cardLight    = Color(0xFFFFFFFF);
  static const Color borderLight  = Color(0xFFE2E8F0);
  static const Color textLight    = Color(0xFF0F172A);
  static const Color mutedLight   = Color(0xFF64748B);
  static const Color dimLight     = Color(0xFF94A3B8);

  // ── Dark theme — MAIN APP ─────────────────────────────────────────────────
  static const Color bgDark       = Color(0xFF060D1A);   // deepest navy
  static const Color surfaceDark  = Color(0xFF0D1B2E);   // card background
  static const Color cardDark     = Color(0xFF1A2940);   // elevated card
  static const Color borderDark   = Color(0xFF1E3A5F);   // blue-ish border
  static const Color textDark     = Color(0xFFE2E8F0);   // primary text
  static const Color mutedDark    = Color(0xFF94A3B8);   // secondary text
  static const Color dimDark      = Color(0xFF475569);   // dim text
  static const Color accentBlue   = Color(0xFF3B82F6);   // bright accent blue

  // ── Module colours ───────────────────────────────────────────────────────
  static const Color pulse        = Color(0xFFDC2626);
  static const Color sentry       = Color(0xFF1E3A8A);
  static const Color scribe       = Color(0xFF059669);
  static const Color gloss        = Color(0xFFD97706);

  // ── Risk levels — matches web dashboard exactly ───────────────────────────
  static const Color high         = Color(0xFFEF4444);
  static const Color moderate     = Color(0xFFF59E0B);
  static const Color low          = Color(0xFF22C55E);
  static const Color normal       = Color(0xFF64748B);

  // ── Gradients ────────────────────────────────────────────────────────────
  static const LinearGradient brandGradient = LinearGradient(
    colors: [Color(0xFF1A56DB), Color(0xFF7C3AED)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient bgGradient = LinearGradient(
    colors: [Color(0xFFF8FAFC), Color(0xFFEFF6FF)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
  static const LinearGradient sentryGradient = LinearGradient(
    colors: [Color(0xFF1A56DB), Color(0xFF0891B2)],
  );
  static const LinearGradient scribeGradient = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF0891B2)],
  );
  static const LinearGradient darkBgGradient = LinearGradient(
    colors: [Color(0xFF060D1A), Color(0xFF0D1B2E)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
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
    fontFamily: 'Roboto',
  );

  static ThemeData dark() => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bgDark,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.accentBlue,
      secondary: AppColors.secondary,
      surface: AppColors.surfaceDark,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFF0A1628),
      selectedItemColor: AppColors.accentBlue,
      unselectedItemColor: AppColors.dimDark,
      elevation: 0,
    ),
    dividerColor: AppColors.borderDark,
    fontFamily: 'Roboto',
  );
}
