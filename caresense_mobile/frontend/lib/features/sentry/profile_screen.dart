import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';

const _bg      = AppColors.bgDark;
const _surface = AppColors.surfaceDark;
const _border  = AppColors.borderDark;
const _text    = AppColors.textDark;
const _muted   = AppColors.mutedDark;

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _notifications = true;
  bool _darkMode      = true; // always dark

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // â"€â"€ Page title â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
            const Text('Profile',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _text)),
            const SizedBox(height: 20),

            // â"€â"€ Avatar + name â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
            Center(child: Column(children: [
              Container(
                width: 80, height: 80,
                decoration: const BoxDecoration(
                  gradient: AppColors.brandGradient,
                  shape: BoxShape.circle,
                ),
                child: const Center(child: Text('š*ï¸', style: TextStyle(fontSize: 36))),
              ),
              const SizedBox(height: 12),
              Text(auth.caregiverName ?? 'Caregiver',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _text)),
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentBlue.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.accentBlue.withOpacity(0.3)),
                ),
                child: const Text('Caregiver Â- Ward: East Wing',
                    style: TextStyle(fontSize: 11, color: AppColors.accentBlue,
                        fontWeight: FontWeight.w600)),
              ),
            ])),
            const SizedBox(height: 24),

            // â"€â"€ Quick actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
            _SectionHeader('Quick Actions'),
            const SizedBox(height: 8),
            _ActionTile(
              icon: Icons.call_outlined,
              label: 'Contact Ward Manager',
              color: AppColors.accentBlue,
              onTap: () {},
            ),
            _ActionTile(
              icon: Icons.emergency_outlined,
              label: 'Call Emergency',
              color: AppColors.high,
              onTap: () {},
            ),
            _ActionTile(
              icon: Icons.report_outlined,
              label: 'Report an Issue',
              color: AppColors.moderate,
              onTap: () {},
            ),
            _ActionTile(
              icon: Icons.help_outline_rounded,
              label: 'Help & Support',
              color: _muted,
              onTap: () {},
            ),
            const SizedBox(height: 22),

            // â"€â"€ App settings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
            _SectionHeader('App Settings'),
            const SizedBox(height: 8),
            _ToggleTile(
              icon: Icons.notifications_outlined,
              label: 'Sound Alerts',
              sub: 'HIGH: continuous Â- MODERATE: single beep',
              value: _notifications,
              color: AppColors.accentBlue,
              onChanged: (v) => setState(() => _notifications = v),
            ),
            _ToggleTile(
              icon: Icons.dark_mode_outlined,
              label: 'Dark Mode',
              sub: 'Night-optimised display',
              value: _darkMode,
              color: AppColors.accentBlue,
              onChanged: (v) => setState(() => _darkMode = v),
            ),
            const SizedBox(height: 24),

            // â"€â"€ Sign out â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  ref.read(authProvider.notifier).signOut();
                  context.go('/auth/login');
                },
                icon: const Icon(Icons.logout_rounded, size: 16, color: AppColors.high),
                label: const Text('Sign Out',
                    style: TextStyle(color: AppColors.high, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppColors.high.withOpacity(0.5)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            const SizedBox(height: 8),
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
      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
          color: AppColors.mutedDark, letterSpacing: 0.5));
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.label,
      required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        dense: true,
        leading: Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        title: Text(label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _text)),
        trailing: Icon(Icons.chevron_right_rounded, color: AppColors.dimDark, size: 18),
        onTap: onTap,
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final bool value;
  final Color color;
  final ValueChanged<bool> onChanged;
  const _ToggleTile({required this.icon, required this.label, required this.sub,
      required this.value, required this.color, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        dense: true,
        leading: Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        title: Text(label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _text)),
        subtitle: Text(sub,
            style: TextStyle(fontSize: 10, color: AppColors.dimDark)),
        trailing: Switch(
          value: value,
          onChanged: onChanged,
          activeColor: color,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}
