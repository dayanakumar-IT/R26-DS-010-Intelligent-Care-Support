import 'dart:math';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/colors.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  final PageController _page = PageController();
  int _current = 0;

  late AnimationController _fadeCtrl;
  late AnimationController _floatCtrl;
  late AnimationController _pulseCtrl;
  late AnimationController _waveCtrl;
  late Animation<double> _fadeAnim;
  late Animation<double> _floatAnim;
  late Animation<double> _pulseAnim;
  late Animation<double> _waveAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _floatCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat(reverse: true);
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
    _waveCtrl  = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();

    _fadeAnim  = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _floatAnim = Tween<double>(begin: -8, end: 8).animate(CurvedAnimation(parent: _floatCtrl, curve: Curves.easeInOut));
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.08).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));
    _waveAnim  = CurvedAnimation(parent: _waveCtrl, curve: Curves.linear);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose(); _floatCtrl.dispose();
    _pulseCtrl.dispose(); _waveCtrl.dispose();
    _page.dispose();
    super.dispose();
  }

  void _next() {
    if (_current < 2) {
      _page.nextPage(duration: const Duration(milliseconds: 450), curve: Curves.easeInOut);
    } else {
      context.go('/auth/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Animated gradient background
          AnimatedContainer(
            duration: const Duration(milliseconds: 600),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _current == 0
                    ? [const Color(0xFFEFF6FF), const Color(0xFFF5F3FF)]
                    : _current == 1
                        ? [const Color(0xFFEFF6FF), const Color(0xFFECFDF5)]
                        : [const Color(0xFFF5F3FF), const Color(0xFFFFF7ED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),

          // Floating background circles
          AnimatedBuilder(
            animation: _floatAnim,
            builder: (_, __) => Stack(children: [
              Positioned(top: -60 + _floatAnim.value, right: -40,
                child: _BgCircle(120, AppColors.primary.withOpacity(0.06))),
              Positioned(bottom: 100 - _floatAnim.value, left: -50,
                child: _BgCircle(160, AppColors.secondary.withOpacity(0.05))),
              Positioned(top: 200 + _floatAnim.value * 0.5, left: 20,
                child: _BgCircle(60, AppColors.teal.withOpacity(0.07))),
            ]),
          ),

          SafeArea(
            child: Column(
              children: [
                // Skip
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Logo
                      Row(children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(
                            gradient: AppColors.brandGradient,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: const Center(child: Text('C',
                            style: TextStyle(color: Colors.white, fontSize: 18,
                              fontWeight: FontWeight.w900))),
                        ),
                        const SizedBox(width: 8),
                        const Text('CareSense',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800,
                            color: AppColors.primaryDark)),
                      ]),
                      GestureDetector(
                        onTap: () => context.go('/auth/login'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.borderLight),
                          ),
                          child: const Text('Skip',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                              color: AppColors.primary)),
                        ),
                      ),
                    ],
                  ),
                ),

                // Pages
                Expanded(
                  child: PageView(
                    controller: _page,
                    onPageChanged: (i) {
                      setState(() => _current = i);
                      _fadeCtrl.reset(); _fadeCtrl.forward();
                    },
                    children: [
                      _Page1(fade: _fadeAnim, float: _floatAnim, pulse: _pulseAnim),
                      _Page2(fade: _fadeAnim, float: _floatAnim, wave: _waveAnim),
                      _Page3(fade: _fadeAnim, float: _floatAnim, pulse: _pulseAnim),
                    ],
                  ),
                ),

                // Bottom controls
                Padding(
                  padding: const EdgeInsets.fromLTRB(28, 0, 28, 36),
                  child: Column(children: [
                    // Dots
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(3, (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 350),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: i == _current ? 32 : 8, height: 8,
                        decoration: BoxDecoration(
                          gradient: i == _current ? AppColors.brandGradient : null,
                          color: i == _current ? null : AppColors.borderLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      )),
                    ),
                    const SizedBox(height: 24),

                    // Next button
                    GestureDetector(
                      onTap: _next,
                      child: Container(
                        width: double.infinity, height: 56,
                        decoration: BoxDecoration(
                          gradient: AppColors.brandGradient,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(
                            color: AppColors.primary.withOpacity(0.35),
                            blurRadius: 20, offset: const Offset(0, 8),
                          )],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _current < 2 ? 'Continue' : 'Get Started',
                              style: const TextStyle(color: Colors.white, fontSize: 16,
                                fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward_rounded,
                              color: Colors.white, size: 18),
                          ],
                        ),
                      ),
                    ),

                    if (_current > 0) ...[
                      const SizedBox(height: 14),
                      GestureDetector(
                        onTap: () => _page.previousPage(
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeInOut),
                        child: const Text('-> Back',
                          style: TextStyle(fontSize: 13, color: AppColors.mutedLight,
                            fontWeight: FontWeight.w500)),
                      ),
                    ],
                  ]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// â"€â"€ Page 1: Welcome â€" all 4 modules â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
class _Page1 extends StatelessWidget {
  final Animation<double> fade, pulse;
  final Animation<double> float;
  const _Page1({required this.fade, required this.float, required this.pulse});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fade,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          children: [
            const SizedBox(height: 12),
            // Animated care illustration
            AnimatedBuilder(
              animation: float,
              builder: (_, __) => Transform.translate(
                offset: Offset(0, float.value),
                child: _CareIllustration(),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Intelligent\nCare Support',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900,
                color: AppColors.textLight, height: 1.15)),
            const SizedBox(height: 10),
            const Text(
              'Four AI-powered modules working together\nto support every caregiver, every shift.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.mutedLight, height: 1.65)),
            const SizedBox(height: 22),
            Row(children: [
              _ModuleTile('[P]', 'PULSE', 'Stress Risk', AppColors.pulse),
              const SizedBox(width: 10),
              _ModuleTile('[S]', 'SENTRY', 'Fall Risk', AppColors.sentry),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _ModuleTile('[D]', 'SCRIBE', 'ADL Docs', AppColors.scribe),
              const SizedBox(width: 10),
              _ModuleTile('[gloss]', 'GLOSS', 'Sign Lang', AppColors.gloss),
            ]),
          ],
        ),
      ),
    );
  }
}

// â"€â"€ Page 2: SENTRY + SCRIBE â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
class _Page2 extends StatelessWidget {
  final Animation<double> fade, wave;
  final Animation<double> float;
  const _Page2({required this.fade, required this.float, required this.wave});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fade,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            // Animated skeleton
            Center(
              child: AnimatedBuilder(
                animation: float,
                builder: (_, __) => Transform.translate(
                  offset: Offset(0, float.value * 0.6),
                  child: _SkeletonAnimation(wave: wave),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Monitor &\nDocument',
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900,
                color: AppColors.textLight, height: 1.15)),
            const SizedBox(height: 20),
            _FeatureCard(
              gradient: AppColors.sentryGradient,
              icon: 'S',
              title: 'SENTRY â€" Fall Risk',
              desc: 'ST-GCN skeletal AI detects fall risk in real-time. 98.3% accuracy on all patient movements.',
              stat: '< 1 sec alert delivery',
            ),
            const SizedBox(height: 12),
            _FeatureCard(
              gradient: AppColors.scribeGradient,
              icon: 'D',
              title: 'SCRIBE â€" Voice to ADL',
              desc: 'Speak naturally â€" AI converts your words into structured ADL documentation instantly.',
              stat: 'Free speech, structured output',
            ),
          ],
        ),
      ),
    );
  }
}

// â"€â"€ Page 3: PULSE + GLOSS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
class _Page3 extends StatelessWidget {
  final Animation<double> fade, pulse;
  final Animation<double> float;
  const _Page3({required this.fade, required this.float, required this.pulse});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fade,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            Center(
              child: AnimatedBuilder(
                animation: pulse,
                builder: (_, __) => Transform.scale(
                  scale: pulse.value,
                  child: _PulseAnimation(),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Wellbeing &\nCommunication',
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900,
                color: AppColors.textLight, height: 1.15)),
            const SizedBox(height: 20),
            _FeatureCard(
              gradient: const LinearGradient(colors: [Color(0xFFDC2626), Color(0xFFDB2777)]),
              icon: 'P',
              title: 'PULSE â€" Caregiver Stress',
              desc: 'Personalized stress-risk detection using proximity networks and physiological signals.',
              stat: 'Causally-ordered detection',
            ),
            const SizedBox(height: 12),
            _FeatureCard(
              gradient: const LinearGradient(colors: [Color(0xFFD97706), Color(0xFF059669)]),
              icon: 'G',
              title: 'GLOSS â€" Sign Language',
              desc: 'Real-time sign recognition and training for caregivers with Deaf patients.',
              stat: 'Per-landmark error localization',
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: Row(children: [
                Container(width: 36, height: 36,
                  decoration: BoxDecoration(
                    gradient: AppColors.brandGradient,
                    borderRadius: BorderRadius.circular(10)),
                  child: const Center(child: Icon(Icons.swap_horiz_rounded,
                    color: Colors.white, size: 18))),
                const SizedBox(width: 12),
                const Expanded(child: Text(
                  'Switch between your assigned modules anytime â€" no re-login needed.',
                  style: TextStyle(fontSize: 12, color: AppColors.mutedLight, height: 1.5))),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

// â"€â"€ Custom widgets â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
class _BgCircle extends StatelessWidget {
  final double size;
  final Color color;
  const _BgCircle(this.size, this.color);
  @override
  Widget build(BuildContext context) => Container(
    width: size, height: size,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

class _ModuleTile extends StatelessWidget {
  final String emoji, name, sub;
  final Color color;
  const _ModuleTile(this.emoji, this.name, this.sub, this.color);
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.25)),
        boxShadow: [BoxShadow(color: color.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Row(children: [
        Container(width: 36, height: 36,
          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: Center(child: Text(emoji, style: const TextStyle(fontSize: 18)))),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color)),
          Text(sub, style: const TextStyle(fontSize: 10, color: AppColors.mutedLight)),
        ]),
      ]),
    ),
  );
}

class _FeatureCard extends StatelessWidget {
  final LinearGradient gradient;
  final String icon, title, desc, stat;
  const _FeatureCard({required this.gradient, required this.icon,
    required this.title, required this.desc, required this.stat});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.borderLight),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
    ),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 46, height: 46,
        decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(13)),
        child: Center(child: Text(icon, style: const TextStyle(fontSize: 22)))),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textLight)),
        const SizedBox(height: 4),
        Text(desc, style: const TextStyle(fontSize: 11, color: AppColors.mutedLight, height: 1.5)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
          child: Text(stat, style: const TextStyle(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.w600)),
        ),
      ])),
    ]),
  );
}

// â"€â"€ Animated illustrations â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
class _CareIllustration extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 180,
    child: CustomPaint(painter: _CarePainter(), size: const Size(300, 180)),
  );
}

class _CarePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width; final h = size.height;

    // Background circle
    canvas.drawCircle(Offset(w * 0.5, h * 0.5), h * 0.46,
      Paint()..color = const Color(0xFFEFF6FF));
    canvas.drawCircle(Offset(w * 0.5, h * 0.5), h * 0.46,
      Paint()..color = const Color(0xFFBFDBFE)..style = PaintingStyle.stroke..strokeWidth = 1.5);

    // Caregiver figure
    canvas.drawCircle(Offset(w*0.5, h*0.2), h*0.1,
      Paint()..color = const Color(0xFFFBCFE8)); // head
    // Scrub torso
    final torso = Path()
      ..moveTo(w*0.36, h*0.33)..lineTo(w*0.30, h*0.65)
      ..lineTo(w*0.70, h*0.65)..lineTo(w*0.64, h*0.33)
      ..quadraticBezierTo(w*0.5, h*0.28, w*0.36, h*0.33)..close();
    canvas.drawPath(torso, Paint()..color = const Color(0xFF1A56DB));

    // White coat lines
    canvas.drawLine(Offset(w*0.5, h*0.33), Offset(w*0.5, h*0.65),
      Paint()..color = Colors.white..strokeWidth = 1.5);

    // Stethoscope
    final sP = Paint()..color = const Color(0xFF7C3AED)..style = PaintingStyle.stroke
      ..strokeWidth = 2..strokeCap = StrokeCap.round;
    final sp = Path()
      ..moveTo(w*0.44, h*0.3)
      ..quadraticBezierTo(w*0.38, h*0.42, w*0.38, h*0.52)
      ..quadraticBezierTo(w*0.38, h*0.60, w*0.5, h*0.60)
      ..quadraticBezierTo(w*0.62, h*0.60, w*0.62, h*0.52);
    canvas.drawPath(sp, sP);
    canvas.drawCircle(Offset(w*0.62, h*0.50), h*0.035,
      Paint()..color = const Color(0xFF7C3AED));

    // Module badges
    _badge(canvas, Offset(w*0.15, h*0.25), '[S]', AppColors.sentry);
    _badge(canvas, Offset(w*0.85, h*0.25), '[D]', AppColors.scribe);
    _badge(canvas, Offset(w*0.15, h*0.65), '[P]', AppColors.pulse);
    _badge(canvas, Offset(w*0.85, h*0.65), '[gloss]', AppColors.gloss);
  }

  void _badge(Canvas canvas, Offset c, String emoji, Color color) {
    canvas.drawRRect(RRect.fromRectAndRadius(
      Rect.fromCenter(center: c, width: 38, height: 26), const Radius.circular(8)),
      Paint()..color = color.withOpacity(0.15));
    canvas.drawRRect(RRect.fromRectAndRadius(
      Rect.fromCenter(center: c, width: 38, height: 26), const Radius.circular(8)),
      Paint()..color = color.withOpacity(0.4)..style = PaintingStyle.stroke..strokeWidth = 1);
    final tp = TextPainter(
      text: TextSpan(text: emoji, style: const TextStyle(fontSize: 14)),
      textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, c - Offset(tp.width/2, tp.height/2));
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

class _SkeletonAnimation extends StatelessWidget {
  final Animation<double> wave;
  const _SkeletonAnimation({required this.wave});
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 160,
    child: AnimatedBuilder(
      animation: wave,
      builder: (_, __) => CustomPaint(
        painter: _SkelPainter(wave.value),
        size: const Size(280, 160),
      ),
    ),
  );
}

class _SkelPainter extends CustomPainter {
  final double t;
  _SkelPainter(this.t);
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width; final h = size.height;
    canvas.drawCircle(Offset(w*0.5, h*0.1), 14, Paint()..color = AppColors.primary.withOpacity(0.8));
    final p = Paint()..color = AppColors.primary..strokeWidth = 3..strokeCap = StrokeCap.round;
    // Body sway
    final sway = sin(t * 2 * pi) * 6;
    canvas.drawLine(Offset(w*0.5, h*0.2), Offset(w*0.5+sway, h*0.55), p);
    canvas.drawLine(Offset(w*0.5, h*0.3), Offset(w*0.3-sway, h*0.48), p);
    canvas.drawLine(Offset(w*0.5, h*0.3), Offset(w*0.7+sway, h*0.45), p);
    canvas.drawLine(Offset(w*0.5+sway, h*0.55), Offset(w*0.4, h*0.82), p..color = AppColors.teal);
    canvas.drawLine(Offset(w*0.5+sway, h*0.55), Offset(w*0.6, h*0.82), p);
    // Risk score badge
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w*0.65, h*0.1, 60, 28), const Radius.circular(8)),
      Paint()..color = AppColors.high.withOpacity(0.12));
    final tp = TextPainter(
      text: const TextSpan(text: 'HIGH 82',
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.high)),
      textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, Offset(w*0.67, h*0.14));
    // Waveform at bottom
    final wp = Paint()..color = AppColors.primary.withOpacity(0.4)..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final wavePath = Path();
    for (double x = 0; x <= w; x += 2) {
      final y = h*0.93 + sin((x/w * 4 * pi) + t * 2 * pi) * 8;
      if (x == 0) { wavePath.moveTo(x, y); } else { wavePath.lineTo(x, y); }
    }
    canvas.drawPath(wavePath, wp);
  }
  @override
  bool shouldRepaint(covariant _SkelPainter old) => old.t != t;
}

class _PulseAnimation extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 160,
    child: CustomPaint(painter: _PulsePainter(), size: const Size(280, 160)));
}

class _PulsePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width; final h = size.height;
    // Concentric rings
    for (int i = 3; i >= 1; i--) {
      canvas.drawCircle(Offset(w*0.5, h*0.5), i * 38.0,
        Paint()..color = AppColors.pulse.withValues(alpha: 0.06 * (4 - i)));
    }
    canvas.drawCircle(Offset(w*0.5, h*0.5), 36,
      Paint()..color = AppColors.pulse.withOpacity(0.15));
    // Heart
    final tp = TextPainter(
      text: const TextSpan(text: '[P]', style: TextStyle(fontSize: 40)),
      textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, Offset(w*0.5 - tp.width/2, h*0.5 - tp.height/2));
    // ECG line
    final ep = Paint()..color = AppColors.pulse..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round..style = PaintingStyle.stroke;
    final ecg = Path()
      ..moveTo(w*0.05, h*0.82)..lineTo(w*0.25, h*0.82)
      ..lineTo(w*0.33, h*0.65)..lineTo(w*0.38, h*0.92)
      ..lineTo(w*0.43, h*0.55)..lineTo(w*0.48, h*0.82)
      ..lineTo(w*0.95, h*0.82);
    canvas.drawPath(ecg, ep);
  }
  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
