import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/colors.dart';

class SignUpScreen extends StatelessWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.bgLight,
        foregroundColor: AppColors.textLight,
        elevation: 0,
        title: const Text('Create Account',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Sign Up',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textLight)),
            const SizedBox(height: 6),
            Text('Your account needs supervisor approval\nbefore you can sign in.',
              style: TextStyle(fontSize: 13, color: AppColors.mutedLight, height: 1.5)),
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: Column(children: [
                _field('Full Name', Icons.person_outline, false),
                const SizedBox(height: 14),
                _field('Email Address', Icons.mail_outline, false),
                const SizedBox(height: 14),
                _field('Phone Number', Icons.phone_outlined, false),
                const SizedBox(height: 14),
                _field('Employee ID', Icons.badge_outlined, false),
                const SizedBox(height: 14),
                _field('Password', Icons.lock_outline, true),
              ]),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => context.go('/auth/otp'),
              child: Container(
                width: double.infinity, height: 52,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.blueStart, AppColors.purpleEnd]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(
                    color: AppColors.accent.withOpacity(0.3),
                    blurRadius: 12, offset: const Offset(0, 4))],
                ),
                child: const Center(
                  child: Text('Send OTP',
                    style: TextStyle(color: Colors.white, fontSize: 16,
                      fontWeight: FontWeight.w700)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: GestureDetector(
                onTap: () => context.go('/auth/login'),
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: 'Already have an account? ',
                    style: TextStyle(color: AppColors.mutedLight, fontSize: 13)),
                  const TextSpan(text: 'Sign In',
                    style: TextStyle(color: AppColors.accent, fontSize: 13,
                      fontWeight: FontWeight.w700)),
                ])),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, IconData icon, bool obscure) {
    return TextField(
      obscureText: obscure,
      style: const TextStyle(fontSize: 14, color: AppColors.textLight),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: AppColors.mutedLight, fontSize: 13),
        prefixIcon: Icon(icon, size: 18, color: AppColors.mutedLight),
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
      ),
    );
  }
}
