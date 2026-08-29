import 'package:flutter/material.dart';
import '../core/constants/colors.dart';
import '../core/services/sentry_service.dart';
import '../features/sentry/sentry_home_screen.dart';
import '../features/sentry/rooms_screen.dart';
import '../features/sentry/alerts_screen.dart';
import '../features/sentry/profile_screen.dart';

// Per-tab accent colors — gamified feel
const _tabColors = [
  Color(0xFF3B82F6), // Home   — blue
  Color(0xFF10B981), // Rooms  — emerald
  Color(0xFFEF4444), // Alerts — red
  Color(0xFF8B5CF6), // Profile — violet
];

const _tabIcons = [
  Icons.home_rounded,
  Icons.meeting_room_rounded,
  Icons.notifications_rounded,
  Icons.person_rounded,
];
const _tabOutlineIcons = [
  Icons.home_outlined,
  Icons.meeting_room_outlined,
  Icons.notifications_outlined,
  Icons.person_outline,
];
const _tabLabels = ['Home', 'Rooms', 'Alerts', 'Profile'];

class SentryNav extends StatefulWidget {
  const SentryNav({super.key});
  @override
  State<SentryNav> createState() => _SentryNavState();
}

class _SentryNavState extends State<SentryNav> with TickerProviderStateMixin {
  int _index = 0;
  int _unackedCount = 0;
  bool _screenLoading = false;

  late final List<AnimationController> _tabControllers;
  late final List<Animation<double>> _scaleAnims;

  final List<Widget> _screens = const [
    SentryHomeScreen(),
    RoomsScreen(),
    AlertsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _tabControllers = List.generate(4, (_) => AnimationController(
      vsync: this, duration: const Duration(milliseconds: 200)));
    _scaleAnims = _tabControllers.map((c) =>
        Tween<double>(begin: 1.0, end: 0.88).animate(
            CurvedAnimation(parent: c, curve: Curves.easeInOut))).toList();
    _fetchAlertCount();
  }

  @override
  void dispose() {
    for (final c in _tabControllers) c.dispose();
    super.dispose();
  }

  Future<void> _fetchAlertCount() async {
    try {
      final alerts = await SentryService.getAlerts(unackedOnly: false);
      final count = alerts.where((a) => a['acknowledged_at'] == null).length;
      if (mounted) setState(() => _unackedCount = count);
    } catch (_) {}
  }

  Future<void> _onTap(int i) async {
    if (i == _index) return;
    // Tap bounce animation
    _tabControllers[i].forward().then((_) => _tabControllers[i].reverse());

    setState(() { _screenLoading = true; _index = i; });
    await Future.delayed(const Duration(milliseconds: 180));
    if (mounted) setState(() => _screenLoading = false);

    if (i == 2) _fetchAlertCount();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: Stack(children: [
        IndexedStack(index: _index, children: _screens),
        // Subtle loading shimmer when switching tabs
        if (_screenLoading)
          Positioned(
            top: 0, left: 0, right: 0,
            child: LinearProgressIndicator(
              backgroundColor: Colors.transparent,
              color: _tabColors[_index],
              minHeight: 3,
            ),
          ),
      ]),
      bottomNavigationBar: _BottomNav(
        index: _index,
        unackedCount: _unackedCount,
        scaleAnims: _scaleAnims,
        onTap: _onTap,
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int index, unackedCount;
  final List<Animation<double>> scaleAnims;
  final Future<void> Function(int) onTap;
  const _BottomNav({
    required this.index, required this.unackedCount,
    required this.scaleAnims, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(4, (i) => _NavItem(
              icon:       _tabOutlineIcons[i],
              activeIcon: _tabIcons[i],
              label:      _tabLabels[i],
              color:      _tabColors[i],
              active:     i == index,
              badge:      i == 2 ? unackedCount : 0,
              scaleAnim:  scaleAnims[i],
              onTap:      () => onTap(i),
            )),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon, activeIcon;
  final String label;
  final Color color;
  final bool active;
  final int badge;
  final Animation<double> scaleAnim;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon, required this.activeIcon, required this.label,
    required this.color, required this.active, required this.badge,
    required this.scaleAnim, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: scaleAnim,
        builder: (_, child) => Transform.scale(scale: scaleAnim.value, child: child),
        child: SizedBox(
          width: 72,
          child: Column(mainAxisSize: MainAxisSize.min, children: [

            // Icon bubble
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOutBack,
              width: active ? 52 : 40,
              height: active ? 36 : 32,
              decoration: BoxDecoration(
                color: active ? color.withValues(alpha: 0.14) : Colors.transparent,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Stack(alignment: Alignment.center, children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    active ? activeIcon : icon,
                    key: ValueKey(active),
                    color: active ? color : const Color(0xFF94A3B8),
                    size: active ? 24 : 22,
                  ),
                ),
                // Badge
                if (badge > 0) Positioned(
                  top: 2, right: 4,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      style: const TextStyle(
                        color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 3),

            // Label
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontSize: 10,
                fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                color: active ? color : const Color(0xFF94A3B8),
              ),
              child: Text(label),
            ),

            // Active dot
            const SizedBox(height: 3),
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: active ? 4 : 0,
              height: active ? 4 : 0,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ]),
        ),
      ),
    );
  }
}
