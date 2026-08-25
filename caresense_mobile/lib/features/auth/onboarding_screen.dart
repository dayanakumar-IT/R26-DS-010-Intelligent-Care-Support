import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/colors.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _page = 0;

  final List<Map<String, String>> _slides = [
    {'emoji': '🏥', 'title': 'Welcome to CareSense', 'sub': 'AI-powered integrated care\nfor every patient, every shift'},
    {'emoji': '🤖', 'title': 'AI-Powered Modules', 'sub': 'SENTRY detects fall risk.\nADL tracks daily activities.'},
    {'emoji': '🛡', 'title': 'Your Patients, Your Modules', 'sub': 'Assigned by your supervisor.\nSwitch modules anytime — no re-login.'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (i) => setState(() => _page = i),
                itemCount: _slides.length,
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_slides[i]['emoji']!, style: const TextStyle(fontSize: 64)),
                      const SizedBox(height: 24),
                      Text(_slides[i]['title']!, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.text), textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      Text(_slides[i]['sub']!, style: TextStyle(fontSize: 14, color: AppColors.muted, height: 1.6), textAlign: TextAlign.center),
                    ],
                  ),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (i) => AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _page ? 20 : 8, height: 4,
                decoration: BoxDecoration(
                  color: i == _page ? AppColors.accent : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              )),
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Row(
                children: [
                  if (_page > 0) ...[
                    Expanded(child: OutlinedButton(onPressed: () => _controller.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.ease), child: const Text('Back'))),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
                      onPressed: () {
                        if (_page < 2) {
                          _controller.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.ease);
                        } else {
                          context.go('/auth/login');
                        }
                      },
                      child: Text(_page < 2 ? 'Next' : 'Get Started', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
