import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final List<TextEditingController> _ctrls =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _nodes = List.generate(6, (_) => FocusNode());
  bool _loading = false;
  int _resendSeconds = 59;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() async {
    while (_resendSeconds > 0 && mounted) {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) setState(() => _resendSeconds--);
    }
  }

  void _verify() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 800));
    if (mounted) {
      ref.read(authProvider.notifier).login(
        caregiverId: 'CG001',
        caregiverName: 'Caregiver',
        token: 'mock-token',
      );
      context.go('/modules');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: () => context.go('/auth/login'),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: const Icon(Icons.arrow_back_ios_new_rounded,
                        size: 16, color: AppColors.textLight),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
                Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.blueStart, AppColors.purpleEnd],
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.3),
                      blurRadius: 16, offset: const Offset(0, 6))],
                  ),
                  child: const Center(child: Text('📱', style: TextStyle(fontSize: 38))),
                ),
                const SizedBox(height: 24),
                const Text('Verify your number',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800,
                    color: AppColors.textLight)),
                const SizedBox(height: 8),
                Text('Enter the 6-digit code sent to your\nregistered mobile number.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: AppColors.mutedLight, height: 1.6)),
                const SizedBox(height: 36),
                // OTP boxes
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(6, (i) => SizedBox(
                    width: 48, height: 56,
                    child: TextField(
                      controller: _ctrls[i],
                      focusNode: _nodes[i],
                      maxLength: 1,
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                        color: AppColors.textLight),
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: Colors.white,
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
                          borderSide: const BorderSide(color: AppColors.accent, width: 2),
                        ),
                      ),
                      onChanged: (v) {
                        if (v.isNotEmpty && i < 5) {
                          _nodes[i + 1].requestFocus();
                        } else if (v.isEmpty && i > 0) {
                          _nodes[i - 1].requestFocus();
                        }
                        if (i == 5 && v.isNotEmpty) _verify();
                      },
                    ),
                  )),
                ),
                const SizedBox(height: 36),
                GestureDetector(
                  onTap: _loading ? null : _verify,
                  child: Container(
                    width: double.infinity, height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.blueStart, AppColors.purpleEnd]),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(
                        color: AppColors.accent.withValues(alpha: 0.3),
                        blurRadius: 12, offset: const Offset(0, 4))],
                    ),
                    child: Center(
                      child: _loading
                        ? const SizedBox(width: 22, height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                        : const Text('Verify & Continue',
                            style: TextStyle(color: Colors.white, fontSize: 16,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text("Didn't receive code? ",
                    style: TextStyle(fontSize: 13, color: AppColors.mutedLight)),
                  GestureDetector(
                    onTap: _resendSeconds == 0 ? () {
                      setState(() => _resendSeconds = 59);
                      _startTimer();
                    } : null,
                    child: Text(
                      _resendSeconds > 0 ? 'Resend in ${_resendSeconds}s' : 'Resend',
                      style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700,
                        color: _resendSeconds == 0 ? AppColors.accent : AppColors.mutedLight,
                      ),
                    ),
                  ),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
