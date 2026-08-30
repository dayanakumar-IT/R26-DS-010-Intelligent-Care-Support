import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../store/auth_store.dart';

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _notifications = true;
  bool _soundAlerts   = true;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final name = auth.caregiverName ?? 'Caregiver';
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'C';

    return Scaffold(
      backgroundColor: _bg,
      body: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [

          // ── Hero section ───────────────────────────────────────────────
          _HeroSection(name: name, initials: initials),

          // ── Stats row ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: Transform.translate(
              offset: const Offset(0, -24),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                decoration: BoxDecoration(
                  color: _surface,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 16, offset: const Offset(0, 4))],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _StatPill('Shift', '08:00', Icons.access_time_rounded,
                        AppColors.accentBlue),
                    _divider(),
                    _StatPill('Ward', 'East', Icons.location_on_rounded,
                        AppColors.teal),
                    _divider(),
                    _StatPill('Status', 'Active', Icons.circle,
                        AppColors.low),
                  ],
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

              // ── Quick Actions ──────────────────────────────────────────
              _SectionLabel('Quick Actions'),
              const SizedBox(height: 8),
              _ActionTile(
                icon: Icons.call_rounded,
                label: 'Contact Ward Manager',
                sub: 'Reach your supervisor',
                color: AppColors.accentBlue,
                onTap: () {},
              ),
              _ActionTile(
                icon: Icons.emergency_rounded,
                label: 'Call Emergency',
                sub: 'Immediate emergency response',
                color: AppColors.high,
                onTap: () {},
              ),
              _ActionTile(
                icon: Icons.flag_rounded,
                label: 'Report an Issue',
                sub: 'Log a device or patient issue',
                color: AppColors.moderate,
                onTap: () {},
              ),
              _ActionTile(
                icon: Icons.help_rounded,
                label: 'Help & Support',
                sub: 'Guides and FAQ',
                color: const Color(0xFF8B5CF6),
                onTap: () {},
              ),
              const SizedBox(height: 24),

              // ── App Settings ──────────────────────────────────────────
              _SectionLabel('App Settings'),
              const SizedBox(height: 8),
              _ToggleTile(
                icon: Icons.notifications_active_rounded,
                label: 'Push Notifications',
                sub: 'Alert banners & sounds',
                value: _notifications,
                color: AppColors.accentBlue,
                onChanged: (v) => setState(() => _notifications = v),
              ),
              _ToggleTile(
                icon: Icons.volume_up_rounded,
                label: 'Sound Alerts',
                sub: 'HIGH: continuous — MODERATE: single beep',
                value: _soundAlerts,
                color: const Color(0xFF8B5CF6),
                onChanged: (v) => setState(() => _soundAlerts = v),
              ),
              const SizedBox(height: 24),

              // ── Sign out ──────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    ref.read(authProvider.notifier).signOut();
                    context.go('/auth/login');
                  },
                  icon: const Icon(Icons.logout_rounded, size: 18),
                  label: const Text('Sign Out',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.high.withValues(alpha: 0.1),
                    foregroundColor: AppColors.high,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: AppColors.high.withValues(alpha: 0.4)),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _divider() => Container(width: 1, height: 36, color: _border);
}

// ── Hero section ─────────────────────────────────────────────────────────────
class _HeroSection extends StatelessWidget {
  final String name, initials;
  const _HeroSection({required this.name, required this.initials});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1A56DB), Color(0xFF7C3AED)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(children: [
        // Decorative circles
        Positioned(right: -20, top: -20,
          child: Container(width: 110, height: 110,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.06)))),
        Positioned(left: -30, bottom: 10,
          child: Container(width: 90, height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.04)))),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
            child: Column(children: [
              // Avatar
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.2),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.4),
                      width: 3),
                ),
                child: Center(child: Text(initials,
                    style: const TextStyle(fontSize: 34,
                        fontWeight: FontWeight.w900, color: Colors.white))),
              ),
              const SizedBox(height: 12),
              Text(name,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900,
                      color: Colors.white)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('Caregiver · SENTRY Module',
                    style: TextStyle(fontSize: 11, color: Colors.white,
                        fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

// ── Stat pill (in the floating card) ────────────────────────────────────────
class _StatPill extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatPill(this.label, this.value, this.icon, this.color);
  @override
  Widget build(BuildContext context) => Column(children: [
    Icon(icon, size: 16, color: color),
    const SizedBox(height: 4),
    Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800,
        color: color)),
    Text(label, style: TextStyle(fontSize: 9, color: _muted)),
  ]);
}

// ── Section label ────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: AppColors.mutedLight, letterSpacing: 0.8));
}

// ── Action tile (no ListTile) ─────────────────────────────────────────────────
class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label, sub;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.label, required this.sub,
      required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Row(children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            Text(label, style: const TextStyle(fontSize: 13,
                fontWeight: FontWeight.w700, color: _text)),
            Text(sub, style: TextStyle(fontSize: 10, color: _muted)),
          ])),
          Icon(Icons.arrow_forward_ios_rounded,
              size: 14, color: _dim),
        ]),
      ),
    );
  }
}

// ── Toggle tile (no ListTile) ────────────────────────────────────────────────
class _ToggleTile extends StatelessWidget {
  final IconData icon;
  final String label, sub;
  final bool value;
  final Color color;
  final ValueChanged<bool> onChanged;
  const _ToggleTile({required this.icon, required this.label, required this.sub,
      required this.value, required this.color, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            children: [
          Text(label, style: const TextStyle(fontSize: 13,
              fontWeight: FontWeight.w700, color: _text)),
          Text(sub, style: TextStyle(fontSize: 10, color: _muted)),
        ])),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: color,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ]),
    );
  }
}

