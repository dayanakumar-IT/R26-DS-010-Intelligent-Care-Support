import 'package:flutter/material.dart';
import '../core/constants/colors.dart';

/// Inline SVG-style caregiver illustration drawn with Canvas
class CaregiverIllustration extends StatelessWidget {
  final double height;
  const CaregiverIllustration({super.key, this.height = 200});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: CustomPaint(
        painter: _CaregiverPainter(),
        size: Size(height * 1.4, height),
      ),
    );
  }
}

class _CaregiverPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // ── Background circle ───────────────────────────────────────────────────
    final bgPaint = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0xFFEFF6FF), Color(0xFFF5F3FF)],
      ).createShader(Rect.fromCircle(center: Offset(w * 0.5, h * 0.5), radius: h * 0.48));
    canvas.drawCircle(Offset(w * 0.5, h * 0.52), h * 0.46, bgPaint);

    // ── Caregiver body (scrubs — teal/blue) ─────────────────────────────────
    final scrubPaint = Paint()
      ..color = const Color(0xFF60A5FA)
      ..style = PaintingStyle.fill;

    // Head
    final headPaint = Paint()..color = const Color(0xFFFBCFE8);
    canvas.drawCircle(Offset(w * 0.45, h * 0.22), h * 0.1, headPaint);

    // Hair
    final hairPaint = Paint()..color = const Color(0xFF7C3AED);
    final hairPath = Path()
      ..moveTo(w * 0.35, h * 0.22)
      ..quadraticBezierTo(w * 0.38, h * 0.10, w * 0.45, h * 0.10)
      ..quadraticBezierTo(w * 0.55, h * 0.10, w * 0.55, h * 0.18)
      ..lineTo(w * 0.55, h * 0.15)
      ..quadraticBezierTo(w * 0.45, h * 0.08, w * 0.35, h * 0.18)
      ..close();
    canvas.drawPath(hairPath, hairPaint);

    // Torso (scrub top)
    final torsoPath = Path()
      ..moveTo(w * 0.33, h * 0.34)
      ..lineTo(w * 0.28, h * 0.62)
      ..lineTo(w * 0.62, h * 0.62)
      ..lineTo(w * 0.57, h * 0.34)
      ..quadraticBezierTo(w * 0.45, h * 0.30, w * 0.33, h * 0.34)
      ..close();
    canvas.drawPath(torsoPath, scrubPaint);

    // Scrub pocket
    final pocketPaint = Paint()
      ..color = const Color(0xFF3B82F6)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.36, h * 0.44, w * 0.10, h * 0.08),
        const Radius.circular(4),
      ),
      pocketPaint,
    );

    // Stethoscope
    final stethPaint = Paint()
      ..color = const Color(0xFF6D28D9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    final stethPath = Path()
      ..moveTo(w * 0.42, h * 0.31)
      ..quadraticBezierTo(w * 0.38, h * 0.40, w * 0.38, h * 0.48)
      ..quadraticBezierTo(w * 0.38, h * 0.58, w * 0.46, h * 0.58)
      ..quadraticBezierTo(w * 0.54, h * 0.58, w * 0.54, h * 0.48);
    canvas.drawPath(stethPath, stethPaint);
    canvas.drawCircle(Offset(w * 0.54, h * 0.46), h * 0.03,
      Paint()..color = const Color(0xFF7C3AED));

    // Arms
    final armPaint = Paint()..color = const Color(0xFFFBCFE8);
    // Left arm
    final leftArm = Path()
      ..moveTo(w * 0.33, h * 0.34)
      ..quadraticBezierTo(w * 0.22, h * 0.44, w * 0.24, h * 0.56)
      ..lineTo(w * 0.29, h * 0.55)
      ..quadraticBezierTo(w * 0.27, h * 0.45, w * 0.36, h * 0.36)
      ..close();
    canvas.drawPath(leftArm, scrubPaint);
    // Left hand
    canvas.drawCircle(Offset(w * 0.245, h * 0.57), h * 0.032, armPaint);

    // Tablet in hand
    final tabletPaint = Paint()..color = const Color(0xFFE0F2FE);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.15, h * 0.50, w * 0.10, h * 0.14),
        const Radius.circular(4),
      ),
      tabletPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.15, h * 0.50, w * 0.10, h * 0.14),
        const Radius.circular(4),
      ),
      Paint()..color = const Color(0xFF93C5FD)..style = PaintingStyle.stroke..strokeWidth = 1.5,
    );
    // Screen lines
    canvas.drawLine(Offset(w * 0.17, h * 0.54), Offset(w * 0.23, h * 0.54),
      Paint()..color = AppColors.accent..strokeWidth = 1);
    canvas.drawLine(Offset(w * 0.17, h * 0.57), Offset(w * 0.21, h * 0.57),
      Paint()..color = AppColors.accent..strokeWidth = 1);

    // Right arm
    final rightArm = Path()
      ..moveTo(w * 0.57, h * 0.34)
      ..quadraticBezierTo(w * 0.68, h * 0.42, w * 0.66, h * 0.54)
      ..lineTo(w * 0.61, h * 0.53)
      ..quadraticBezierTo(w * 0.63, h * 0.44, w * 0.55, h * 0.36)
      ..close();
    canvas.drawPath(rightArm, scrubPaint);
    canvas.drawCircle(Offset(w * 0.665, h * 0.55), h * 0.032, armPaint);

    // Legs
    final legPaint = Paint()..color = const Color(0xFF93C5FD);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.33, h * 0.62, w * 0.11, h * 0.22),
        const Radius.circular(6),
      ),
      legPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.47, h * 0.62, w * 0.11, h * 0.22),
        const Radius.circular(6),
      ),
      legPaint,
    );

    // Shoes
    final shoePaint = Paint()..color = const Color(0xFF1E40AF);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.31, h * 0.82, w * 0.15, h * 0.06),
        const Radius.circular(4),
      ),
      shoePaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.45, h * 0.82, w * 0.15, h * 0.06),
        const Radius.circular(4),
      ),
      shoePaint,
    );

    // ── Floating badges ─────────────────────────────────────────────────────
    _drawBadge(canvas, Offset(w * 0.82, h * 0.22), '🛡', 'SENTRY', AppColors.sentry);
    _drawBadge(canvas, Offset(w * 0.82, h * 0.52), '🎤', 'SCRIBE', AppColors.scribe);
    _drawBadge(canvas, Offset(w * 0.10, h * 0.30), '💓', 'PULSE', AppColors.pulse);
  }

  void _drawBadge(Canvas canvas, Offset center, String emoji, String label, Color color) {
    final bgPaint = Paint()..color = color.withValues(alpha: 0.12);
    final borderPaint = Paint()
      ..color = color.withValues(alpha: 0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: center, width: 52, height: 32),
      const Radius.circular(10),
    );
    canvas.drawRRect(rect, bgPaint);
    canvas.drawRRect(rect, borderPaint);

    final tp = TextPainter(
      text: TextSpan(
        text: '$emoji $label',
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
