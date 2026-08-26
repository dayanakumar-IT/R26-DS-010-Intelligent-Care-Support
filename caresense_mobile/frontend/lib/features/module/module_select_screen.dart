import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/module_store.dart';

class ModuleSelectScreen extends ConsumerWidget {
  const ModuleSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.bgGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 24),
                // Header
                Row(children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.blueStart, AppColors.purpleEnd]),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(child: Text('C',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white))),
                  ),
                  const SizedBox(width: 10),
                  ShaderMask(
                    shaderCallback: (b) => const LinearGradient(
                      colors: [AppColors.blueStart, AppColors.purpleEnd]).createShader(b),
                    child: const Text('CareSense',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
                  ),
                ]),
                const SizedBox(height: 28),
                const Text('Choose your module',
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: AppColors.textLight)),
                const SizedBox(height: 4),
                Text('Your accessible modules are highlighted',
                  style: TextStyle(fontSize: 13, color: AppColors.mutedLight)),
                const SizedBox(height: 24),

                // SENTRY — accessible
                _ModuleCard(
                  emoji: '🛡',
                  name: 'SENTRY',
                  tagline: 'Fall Risk Detection',
                  desc: 'Real-time skeletal AI monitors patient movement and detects fall risk before incidents happen.',
                  stat: '● 2 high-risk alerts active',
                  color: AppColors.sentry,
                  accessible: true,
                  onTap: () {
                    ref.read(moduleProvider.notifier).switchTo(ActiveModule.sentry);
                    context.go('/sentry');
                  },
                ),
                const SizedBox(height: 12),

                // SCRIBE — accessible
                _ModuleCard(
                  emoji: '🎤',
                  name: 'SCRIBE',
                  tagline: 'Voice to ADL Documentation',
                  desc: 'Speak naturally — AI converts free caregiver speech into structured ADL records instantly.',
                  stat: '● 6 patients active today',
                  color: AppColors.scribe,
                  accessible: true,
                  onTap: () {
                    ref.read(moduleProvider.notifier).switchTo(ActiveModule.scribe);
                    context.go('/scribe');
                  },
                ),
                const SizedBox(height: 16),

                // Locked modules
                Text('Not assigned to you',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                    color: AppColors.mutedLight)),
                const SizedBox(height: 10),
                Row(children: [
                  _LockedPill('💓', 'PULSE', AppColors.pulse),
                  const SizedBox(width: 8),
                  _LockedPill('🤟', 'GLOSS', AppColors.gloss),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  final String emoji, name, tagline, desc, stat;
  final Color color;
  final bool accessible;
  final VoidCallback onTap;
  const _ModuleCard({required this.emoji, required this.name, required this.tagline,
    required this.desc, required this.stat, required this.color,
    required this.accessible, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.3), width: 1.5),
          boxShadow: [BoxShadow(
            color: color.withValues(alpha: 0.1), blurRadius: 16, offset: const Offset(0, 4))],
        ),
        child: Row(
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(child: Text(emoji, style: const TextStyle(fontSize: 28))),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(name, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('Active', style: TextStyle(fontSize: 9,
                      fontWeight: FontWeight.w700, color: color)),
                  ),
                ]),
                const SizedBox(height: 2),
                Text(tagline, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                  color: AppColors.textLight)),
                const SizedBox(height: 4),
                Text(desc, style: TextStyle(fontSize: 11, color: AppColors.mutedLight, height: 1.4)),
                const SizedBox(height: 6),
                Text(stat, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
              ],
            )),
            Icon(Icons.arrow_forward_ios_rounded, color: color, size: 14),
          ],
        ),
      ),
    );
  }
}

class _LockedPill extends StatelessWidget {
  final String emoji, label;
  final Color color;
  const _LockedPill(this.emoji, this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Opacity(
        opacity: 0.45,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('🔒', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
            Text(emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          ]),
        ),
      ),
    );
  }
}
