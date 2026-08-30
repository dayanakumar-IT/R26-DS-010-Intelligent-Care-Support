import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';
import '../../widgets/caregiver_illustration.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _obscure  = true;
  bool _loading  = false;
  bool _emailFocused = false;
  bool _passFocused  = false;

  late final AnimationController _slideCtrl;
  late final Animation<Offset> _slideAnim;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _slideCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 700));
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.18), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));
    _fadeAnim = CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOut);
    _slideCtrl.forward();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _slideCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final email = _emailCtrl.text.trim();
    final pass  = _passCtrl.text;
    if (email.isEmpty || pass.isEmpty) return;

    setState(() => _loading = true);
    final error = await ref.read(authProvider.notifier).signIn(email, pass);
    if (!mounted) return;
    setState(() => _loading = false);

    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Row(children: [
          const Icon(Icons.error_outline, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(error,
              style: const TextStyle(color: Colors.white))),
        ]),
        backgroundColor: AppColors.high,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ));
    } else {
      context.go('/modules');
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(children: [

        // ── Gradient background (full screen) ──────────────────────────────
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF1A56DB), Color(0xFF5B21B6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),

        // Decorative circles on gradient
        Positioned(top: -40, right: -40,
          child: Container(width: 180, height: 180,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.06)))),
        Positioned(top: 100, left: -60,
          child: Container(width: 140, height: 140,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.04)))),

        SafeArea(
          child: Column(children: [

            // ── Top brand + illustration ─────────────────────────────────
            SizedBox(
              height: screenH * 0.38,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.4)),
                      ),
                      child: const Center(child: Text('C',
                          style: TextStyle(fontSize: 20,
                              fontWeight: FontWeight.w900, color: Colors.white))),
                    ),
                    const SizedBox(width: 10),
                    const Text('CareSense',
                        style: TextStyle(fontSize: 22,
                            fontWeight: FontWeight.w900, color: Colors.white)),
                  ]),
                  const SizedBox(height: 12),
                  // Module chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(width: 6, height: 6,
                          decoration: const BoxDecoration(
                              color: Color(0xFF4ADE80),
                              shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      const Text('SENTRY — Fall Risk Module',
                          style: TextStyle(fontSize: 11,
                              fontWeight: FontWeight.w600, color: Colors.white)),
                    ]),
                  ),
                  const SizedBox(height: 8),
                  const CaregiverIllustration(height: 150),
                ],
              ),
            ),

            // ── Sliding form card ────────────────────────────────────────
            Expanded(
              child: SlideTransition(
                position: _slideAnim,
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(
                          top: Radius.circular(32)),
                    ),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [

                        // Handle bar
                        Center(child: Container(
                          width: 36, height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.borderLight,
                            borderRadius: BorderRadius.circular(2)),
                        )),
                        const SizedBox(height: 20),

                        // Heading
                        const Text('Welcome back',
                            style: TextStyle(fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: AppColors.textLight)),
                        const SizedBox(height: 4),
                        Text('Sign in to your caregiver account',
                            style: TextStyle(fontSize: 13,
                                color: AppColors.mutedLight)),
                        const SizedBox(height: 28),

                        // Email field
                        _FieldLabel('Email address'),
                        const SizedBox(height: 6),
                        Focus(
                          onFocusChange: (f) =>
                              setState(() => _emailFocused = f),
                          child: _StyledField(
                            controller: _emailCtrl,
                            hint: 'caregiver@hospital.com',
                            icon: Icons.mail_outline_rounded,
                            obscure: false,
                            focused: _emailFocused,
                            keyboardType: TextInputType.emailAddress,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Password field
                        _FieldLabel('Password'),
                        const SizedBox(height: 6),
                        Focus(
                          onFocusChange: (f) =>
                              setState(() => _passFocused = f),
                          child: _StyledField(
                            controller: _passCtrl,
                            hint: 'Enter your password',
                            icon: Icons.lock_outline_rounded,
                            obscure: _obscure,
                            focused: _passFocused,
                            suffix: GestureDetector(
                              onTap: () =>
                                  setState(() => _obscure = !_obscure),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Icon(
                                  _obscure
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  size: 18,
                                  color: AppColors.mutedLight,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Forgot password
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text('Forgot password?',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.primaryLight,
                                fontWeight: FontWeight.w700)),
                        ),
                        const SizedBox(height: 28),

                        // Sign In button
                        GestureDetector(
                          onTap: _loading ? null : _login,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: double.infinity,
                            height: 54,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: _loading
                                    ? [const Color(0xFF94A3B8),
                                       const Color(0xFF94A3B8)]
                                    : [AppColors.blueStart, AppColors.purpleEnd],
                              ),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: _loading ? [] : [
                                BoxShadow(
                                  color: AppColors.primary.withValues(
                                      alpha: 0.35),
                                  blurRadius: 16, offset: const Offset(0, 6)),
                              ],
                            ),
                            child: Center(
                              child: _loading
                                  ? const SizedBox(width: 22, height: 22,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          color: Colors.white))
                                  : const Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text('Sign In',
                                            style: TextStyle(
                                                color: Colors.white,
                                                fontSize: 16,
                                                fontWeight: FontWeight.w800)),
                                        SizedBox(width: 8),
                                        Icon(Icons.arrow_forward_rounded,
                                            color: Colors.white, size: 18),
                                      ],
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Info note
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.accentBlue.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: AppColors.accentBlue.withValues(
                                    alpha: 0.15)),
                          ),
                          child: Row(children: [
                            Icon(Icons.info_outline_rounded,
                                size: 16,
                                color: AppColors.accentBlue.withValues(
                                    alpha: 0.7)),
                            const SizedBox(width: 10),
                            const Expanded(child: Text(
                              'Accounts are created by your supervisor. Contact admin if you need access.',
                              style: TextStyle(fontSize: 11,
                                  color: AppColors.mutedLight, height: 1.5),
                            )),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ── Field label ───────────────────────────────────────────────────────────────
class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
          color: AppColors.textLight));
}

// ── Styled text field ─────────────────────────────────────────────────────────
class _StyledField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final bool focused;
  final Widget? suffix;
  final TextInputType? keyboardType;

  const _StyledField({
    required this.controller,
    required this.hint,
    required this.icon,
    required this.obscure,
    required this.focused,
    this.suffix,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: focused
                ? AppColors.primary.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: focused ? 12 : 6,
            offset: const Offset(0, 3),
          ),
        ],
        border: Border.all(
          color: focused
              ? AppColors.primaryLight
              : AppColors.borderLight,
          width: focused ? 1.5 : 1.0,
        ),
      ),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 14, color: AppColors.textLight),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
              color: AppColors.dimLight, fontSize: 13),
          prefixIcon: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Icon(icon, size: 18,
                color: focused ? AppColors.primaryLight : AppColors.mutedLight),
          ),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 48, minHeight: 48),
          suffixIcon: suffix,
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
        ),
      ),
    );
  }
}
