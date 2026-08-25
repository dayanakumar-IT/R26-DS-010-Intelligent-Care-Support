import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final emailCtrl = TextEditingController();
    final passCtrl  = TextEditingController();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('CareSense', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.accentLight)),
                const SizedBox(height: 8),
                const Text('Sign In', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.text)),
                const SizedBox(height: 4),
                Text('Caregiver access only', style: TextStyle(fontSize: 13, color: AppColors.muted)),
                const SizedBox(height: 32),
                _field('Email', emailCtrl, false),
                const SizedBox(height: 14),
                _field('Password', passCtrl, true),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, padding: const EdgeInsets.symmetric(vertical: 14)),
                    onPressed: () {
                      // TODO: call auth API, get token
                      // For now: mock login → go to OTP
                      context.go('/auth/otp');
                    },
                    child: const Text('Continue', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ),
                const SizedBox(height: 16),
                Center(child: GestureDetector(
                  onTap: () => context.go('/auth/signup'),
                  child: Text.rich(TextSpan(children: [
                    TextSpan(text: "Don't have an account? ", style: TextStyle(color: AppColors.muted, fontSize: 13)),
                    const TextSpan(text: 'Sign Up', style: TextStyle(color: AppColors.accent, fontSize: 13, fontWeight: FontWeight.w700)),
                  ])),
                )),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, bool obscure) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          style: const TextStyle(color: AppColors.text, fontSize: 14),
          decoration: InputDecoration(
            filled: true, fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
      ],
    );
  }
}
