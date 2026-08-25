import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/colors.dart';

class OtpScreen extends StatelessWidget {
  const OtpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.background, foregroundColor: AppColors.text, title: const Text('Verify OTP')),
      body: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          children: [
            const Text('📱', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 16),
            const Text('Enter the 6-digit code sent to your registered mobile number.', style: TextStyle(color: AppColors.text, fontSize: 14), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            // TODO: Add OTP input fields (6 boxes)
            Text('OTP input — TODO', style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () => context.go('/modules'),
                child: const Text('Verify', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
