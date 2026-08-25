import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../widgets/caregiver_illustration.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _obscure = true;
  bool _loading = false;

  @override
  void dispose() { _emailCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }

  Future<void> _login() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 800)); // mock
    if (mounted) {
      setState(() => _loading = false);
      context.go('/auth/otp');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.brandGradientVertical),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Column(
              children: [
                // ── Top section with illustration ──────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                  child: Column(
                    children: [
                      // Logo row
                      Row(
                        children: [
                          Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.blueStart, AppColors.purpleEnd],
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Center(
                              child: Text('C', style: TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          ShaderMask(
                            shaderCallback: (b) => const LinearGradient(
                              colors: [AppColors.blueStart, AppColors.purpleEnd],
                            ).createShader(b),
                            child: const Text('CareSense',
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900,
                                color: Colors.white)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const CaregiverIllustration(height: 180),
                    ],
                  ),
                ),

                // ── Form card ────────────────────────────────────────────────
                Container(
                  margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.accent.withOpacity(0.08),
                        blurRadius: 24, offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Welcome back 👋',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                          color: AppColors.textLight)),
                      const SizedBox(height: 4),
                      Text('Sign in to your caregiver account',
                        style: TextStyle(fontSize: 13, color: AppColors.mutedLight)),
                      const SizedBox(height: 24),

                      // Email
                      _Label('Email address'),
                      const SizedBox(height: 6),
                      _Field(
                        controller: _emailCtrl,
                        hint: 'caregiver@hospital.com',
                        icon: Icons.mail_outline_rounded,
                        obscure: false,
                      ),
                      const SizedBox(height: 16),

                      // Password
                      _Label('Password'),
                      const SizedBox(height: 6),
                      _Field(
                        controller: _passCtrl,
                        hint: '••••••••',
                        icon: Icons.lock_outline_rounded,
                        obscure: _obscure,
                        suffix: GestureDetector(
                          onTap: () => setState(() => _obscure = !_obscure),
                          child: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                            size: 18, color: AppColors.mutedLight),
                        ),
                      ),
                      const SizedBox(height: 10),

                      Align(
                        alignment: Alignment.centerRight,
                        child: Text('Forgot password?',
                          style: TextStyle(fontSize: 12, color: AppColors.accent,
                            fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(height: 24),

                      // Sign in button
                      GestureDetector(
                        onTap: _loading ? null : _login,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: double.infinity, height: 52,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.blueStart, AppColors.purpleEnd],
                            ),
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.accent.withOpacity(0.3),
                                blurRadius: 12, offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Center(
                            child: _loading
                              ? const SizedBox(width: 22, height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5, color: Colors.white))
                              : const Text('Sign In',
                                  style: TextStyle(color: Colors.white, fontSize: 16,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Divider
                      Row(children: [
                        Expanded(child: Divider(color: AppColors.borderLight)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text('or', style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
                        ),
                        Expanded(child: Divider(color: AppColors.borderLight)),
                      ]),
                      const SizedBox(height: 20),

                      // Biometric
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _BiometricBtn(icon: Icons.fingerprint_rounded, label: 'Fingerprint'),
                          const SizedBox(width: 16),
                          _BiometricBtn(icon: Icons.face_retouching_natural, label: 'Face ID'),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Sign up link
                      Center(
                        child: GestureDetector(
                          onTap: () => context.go('/auth/signup'),
                          child: Text.rich(TextSpan(children: [
                            TextSpan(text: "New caregiver? ",
                              style: TextStyle(color: AppColors.mutedLight, fontSize: 13)),
                            const TextSpan(text: 'Request Access',
                              style: TextStyle(color: AppColors.accent, fontSize: 13,
                                fontWeight: FontWeight.w700)),
                          ])),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textLight));
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final Widget? suffix;
  const _Field({required this.controller, required this.hint,
    required this.icon, required this.obscure, this.suffix});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(fontSize: 14, color: AppColors.textLight),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: AppColors.dimLight, fontSize: 13),
        prefixIcon: Icon(icon, size: 18, color: AppColors.mutedLight),
        suffixIcon: suffix,
        filled: true,
        fillColor: AppColors.bgLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}

class _BiometricBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  const _BiometricBtn({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 22, color: AppColors.accent),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
          color: AppColors.textLight)),
      ]),
    );
  }
}
