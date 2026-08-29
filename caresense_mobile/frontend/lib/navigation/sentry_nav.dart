import 'package:flutter/material.dart';
import '../core/constants/colors.dart';
import '../core/services/sentry_service.dart';
import '../features/sentry/sentry_home_screen.dart';
import '../features/sentry/rooms_screen.dart';
import '../features/sentry/alerts_screen.dart';
import '../features/sentry/profile_screen.dart';

class SentryNav extends StatefulWidget {
  const SentryNav({super.key});
  @override
  State<SentryNav> createState() => _SentryNavState();
}

class _SentryNavState extends State<SentryNav> {
  int _index = 0;
  int _unackedCount = 0;

  final List<Widget> _screens = const [
    SentryHomeScreen(),
    RoomsScreen(),
    AlertsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _fetchAlertCount();
  }

  Future<void> _fetchAlertCount() async {
    try {
      final alerts = await SentryService.getAlerts(unackedOnly: false);
      final count = alerts.where((a) => a['acknowledged_at'] == null).length;
      if (mounted) setState(() => _unackedCount = count);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0A1628),
          border: Border(top: BorderSide(color: AppColors.borderDark, width: 1)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(icon: Icons.home_outlined,          activeIcon: Icons.home_rounded,              label: 'Home',    index: 0, current: _index, onTap: _onTap),
                _NavItem(icon: Icons.meeting_room_outlined,  activeIcon: Icons.meeting_room_rounded,      label: 'Rooms',   index: 1, current: _index, onTap: _onTap),
                _NavItem(icon: Icons.notifications_outlined, activeIcon: Icons.notifications_rounded,     label: 'Alerts',  index: 2, current: _index, onTap: _onTap, badge: _unackedCount),
                _NavItem(icon: Icons.person_outline,         activeIcon: Icons.person_rounded,            label: 'Profile', index: 3, current: _index, onTap: _onTap),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _onTap(int i) {
    setState(() => _index = i);
    if (i == 2) _fetchAlertCount(); // refresh alert count on alerts tab
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon, activeIcon;
  final String label;
  final int index, current;
  final void Function(int) onTap;
  final int badge;
  const _NavItem({
    required this.icon, required this.activeIcon,
    required this.label, required this.index,
    required this.current, required this.onTap,
    this.badge = 0,
  });

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    final col = active ? AppColors.accentBlue : AppColors.dimDark;

    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 70,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Icon with optional badge
          Stack(clipBehavior: Clip.none, children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: active ? BoxDecoration(
                color: AppColors.accentBlue.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ) : null,
              child: Icon(active ? activeIcon : icon, color: col, size: 22),
            ),
            if (badge > 0) Positioned(
              top: -2, right: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: const BoxDecoration(
                    color: AppColors.high, shape: BoxShape.circle),
                child: Text('$badge',
                    style: const TextStyle(color: Colors.white, fontSize: 8,
                        fontWeight: FontWeight.w800)),
              ),
            ),
          ]),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(
              fontSize: 10, fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: col)),
        ]),
      ),
    );
  }
}
