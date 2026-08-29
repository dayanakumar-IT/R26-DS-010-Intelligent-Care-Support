import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _notifications = true;
  bool _darkMode      = false;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Profile',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
            const SizedBox(height: 20),

            // ── Avatar + name ─────────────────────────────────────────
            Center(child: Column(children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  gradient: AppColors.brandGradient,
                  shape: BoxShape.circle,
                ),
                child: const Center(child: Text('👩‍⚕️', style: TextStyle(fontSize: 32))),
              ),
              const SizedBox(height: 10),
              Text(auth.caregiverName ?? 'Caregiver',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textLight)),
              Text('Caregiver · SENTRY Module',
                  style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
            ])),
            const SizedBox(height: 24),

            // ── Quick actions ─────────────────────────────────────────
            _SectionHeader('Quick Actions'),
            const SizedBox(height: 8),
            _ActionTile(icon: Icons.call_outlined,         label: 'Contact Ward Manager',  color: AppColors.primary),
            _ActionTile(icon: Icons.emergency_outlined,    label: 'Call Emergency',         color: AppColors.high),
            _ActionTile(icon: Icons.report_outlined,       label: 'Report an Issue',        color: AppColors.moderate),
            _ActionTile(icon: Icons.help_outline_rounded,  label: 'Help & Support',         color: AppColors.mutedLight),
            const SizedBox(height: 20),

            // ── App settings ──────────────────────────────────────────
            _SectionHeader('App Settings'),
            const SizedBox(height: 8),
            _ToggleTile(
              icon: Icons.notifications_outlined,
              label: 'Notifications',
              value: _notifications,
              onChanged: (v) => setState(() => _notifications = v),
            ),
            _ToggleTile(
              icon: Icons.dark_mode_outlined,
              label: 'Dark Mode',
              value: _darkMode,
              onChanged: (v) => setState(() => _darkMode = v),
            ),
            const SizedBox(height: 24),

            // ── Sign out ──────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  ref.read(authProvider.notifier).signOut();
                  context.go('/auth/login');
                },
                icon: const Icon(Icons.logout_rounded, size: 16, color: AppColors.high),
                label: const Text('Sign Out', style: TextStyle(color: AppColors.high, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.high),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textLight));
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _ActionTile({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        dense: true,
        leading: Icon(icon, color: color, size: 20),
        title: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textLight)),
        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.mutedLight, size: 18),
        onTap: () {},
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _ToggleTile({required this.icon, required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        dense: true,
        leading: Icon(icon, color: AppColors.mutedLight, size: 20),
        title: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textLight)),
        trailing: Switch(
          value: value,
          onChanged: onChanged,
          activeColor: AppColors.primary,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}
