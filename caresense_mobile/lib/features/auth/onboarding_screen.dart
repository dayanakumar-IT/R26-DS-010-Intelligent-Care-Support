import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/colors.dart';
import '../../widgets/caregiver_illustration.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  final PageController _page = PageController();
  int _current = 0;
  late AnimationController _anim;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _fadeIn  = CurvedAnimation(parent: _anim, curve: Curves.easeOut);
    _slideUp = Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero)
        .animate(CurvedAnimation(parent: _anim, curve: Curves.easeOutCubic));
    _anim.forward();
  }

  @override
  void dispose() { _anim.dispose(); _page.dispose(); super.dispose(); }

  void _next() {
    if (_current < 2) {
      _page.nextPage(duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
    } else {
      context.go('/auth/login');
    }
  }

  void _skip() => context.go('/auth/login');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.brandGradientVertical),
        child: SafeArea(
          child: Column(
            children: [
              // Skip button
              Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: GestureDetector(
                    onTap: _skip,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: const Text('Skip',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                          color: AppColors.accent)),
                    ),
                  ),
                ),
              ),

              // Pages
              Expanded(
                child: PageView(
                  controller: _page,
                  onPageChanged: (i) {
                    setState(() => _current = i);
                    _anim.reset();
                    _anim.forward();
                  },
                  children: [
                    _OnboardPage1(fadeIn: _fadeIn, slideUp: _slideUp),
                    _OnboardPage2(fadeIn: _fadeIn, slideUp: _slideUp),
                    _OnboardPage3(fadeIn: _fadeIn, slideUp: _slideUp),
                  ],
                ),
              ),

              // Dots + button
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 0, 28, 32),
                child: Column(
                  children: [
                    // Dots
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(3, (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: i == _current ? 28 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          gradient: i == _current
                              ? const LinearGradient(colors: [AppColors.blueStart, AppColors.purpleEnd])
                              : null,
                          color: i == _current ? null : AppColors.borderLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      )),
                    ),
                    const SizedBox(height: 28),
                    // Next button
                    GestureDetector(
                      onTap: _next,
                      child: Container(
                        width: double.infinity,
                        height: 54,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.blueStart, AppColors.purpleEnd],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.accent.withOpacity(0.3),
                              blurRadius: 16, offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Text(
                            _current < 2 ? 'Continue' : 'Get Started',
                            style: const TextStyle(
                              color: Colors.white, fontSize: 16,
                              fontWeight: FontWeight.w700, letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (_current > 0) ...[
                      const SizedBox(height: 14),
                      GestureDetector(
                        onTap: () => _page.previousPage(
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeInOut),
                        child: const Text('← Back',
                          style: TextStyle(fontSize: 13, color: AppColors.mutedLight,
                            fontWeight: FontWeight.w500)),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Page 1: Welcome + all 4 modules ────────────────────────────────────────
class _OnboardPage1 extends StatelessWidget {
  final Animation<double> fadeIn;
  final Animation<Offset> slideUp;
  const _OnboardPage1({required this.fadeIn, required this.slideUp});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fadeIn,
      child: SlideTransition(
        position: slideUp,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const SizedBox(height: 8),
              // Illustration
              const CaregiverIllustration(height: 200),
              const SizedBox(height: 24),
              ShaderMask(
                shaderCallback: (b) => const LinearGradient(
                  colors: [AppColors.blueStart, AppColors.purpleEnd],
                ).createShader(b),
                child: const Text('One Platform,\nComplete Care',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900,
                    color: Colors.white, height: 1.2)),
              ),
              const SizedBox(height: 12),
              Text('CareSense brings four AI-powered modules\ntogether in one caregiver workflow.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: AppColors.mutedLight, height: 1.6)),
              const SizedBox(height: 24),
              // 4 module pills
              Row(children: [
                _ModulePill('💓', 'PULSE', AppColors.pulse),
                const SizedBox(width: 8),
                _ModulePill('🛡', 'SENTRY', AppColors.sentry),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                _ModulePill('🎤', 'SCRIBE', AppColors.scribe),
                const SizedBox(width: 8),
                _ModulePill('🤟', 'GLOSS', AppColors.gloss),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Page 2: PULSE + SENTRY ──────────────────────────────────────────────────
class _OnboardPage2 extends StatelessWidget {
  final Animation<double> fadeIn;
  final Animation<Offset> slideUp;
  const _OnboardPage2({required this.fadeIn, required this.slideUp});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fadeIn,
      child: SlideTransition(
        position: slideUp,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Center(
                child: Container(
                  width: 130, height: 130,
                  decoration: BoxDecoration(
                    color: AppColors.sentry.withOpacity(0.08),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.sentry.withOpacity(0.2), width: 2),
                  ),
                  child: const Center(child: Text('🛡💓', style: TextStyle(fontSize: 52))),
                ),
              ),
              const SizedBox(height: 24),
              ShaderMask(
                shaderCallback: (b) => const LinearGradient(
                  colors: [AppColors.blueStart, AppColors.purpleEnd],
                ).createShader(b),
                child: const Text('Safety &\nWellbeing',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900,
                    color: Colors.white, height: 1.2)),
              ),
              const SizedBox(height: 20),
              _FeatureRow(
                color: AppColors.sentry,
                icon: '🛡',
                title: 'SENTRY — Fall Risk',
                sub: 'AI skeletal analysis detects fall risk in real-time before incidents happen. 98.3% accuracy.',
              ),
              const SizedBox(height: 14),
              _FeatureRow(
                color: AppColors.pulse,
                icon: '💓',
                title: 'PULSE — Caregiver Stress',
                sub: 'Personalized stress-risk detection using caregiver proximity network and physiological signals.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Page 3: SCRIBE + GLOSS ──────────────────────────────────────────────────
class _OnboardPage3 extends StatelessWidget {
  final Animation<double> fadeIn;
  final Animation<Offset> slideUp;
  const _OnboardPage3({required this.fadeIn, required this.slideUp});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fadeIn,
      child: SlideTransition(
        position: slideUp,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Center(
                child: Container(
                  width: 130, height: 130,
                  decoration: BoxDecoration(
                    color: AppColors.scribe.withOpacity(0.08),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.scribe.withOpacity(0.2), width: 2),
                  ),
                  child: const Center(child: Text('🎤🤟', style: TextStyle(fontSize: 52))),
                ),
              ),
              const SizedBox(height: 24),
              ShaderMask(
                shaderCallback: (b) => const LinearGradient(
                  colors: [AppColors.scribe, AppColors.gloss],
                ).createShader(b),
                child: const Text('Documentation\n& Communication',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900,
                    color: Colors.white, height: 1.2)),
              ),
              const SizedBox(height: 20),
              _FeatureRow(
                color: AppColors.scribe,
                icon: '🎤',
                title: 'SCRIBE — Voice to ADL',
                sub: 'Speak naturally — SCRIBE converts free caregiver speech into structured ADL documentation automatically.',
              ),
              const SizedBox(height: 14),
              _FeatureRow(
                color: AppColors.gloss,
                icon: '🤟',
                title: 'GLOSS — Sign Language',
                sub: 'Real-time sign-language support and learning for caregivers working with Deaf patients.',
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(children: [
                  const Text('✅', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 10),
                  Expanded(child: Text(
                    'Your supervisor assigns your modules. Switch anytime — no re-login needed.',
                    style: TextStyle(fontSize: 12, color: AppColors.mutedLight, height: 1.5),
                  )),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Shared widgets ──────────────────────────────────────────────────────────
class _ModulePill extends StatelessWidget {
  final String emoji, label;
  final Color color;
  const _ModulePill(this.emoji, this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final Color color;
  final String icon, title, sub;
  const _FeatureRow({required this.color, required this.icon, required this.title, required this.sub});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(child: Text(icon, style: const TextStyle(fontSize: 22))),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textLight)),
            const SizedBox(height: 3),
            Text(sub, style: TextStyle(fontSize: 12, color: AppColors.mutedLight, height: 1.5)),
          ],
        )),
      ],
    );
  }
}
