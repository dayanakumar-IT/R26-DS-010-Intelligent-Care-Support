import 'package:flutter/material.dart';
import '../core/constants/colors.dart';
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
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    SentryHomeScreen(),
    RoomsScreen(),
    AlertsScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.accent,
        unselectedItemColor: AppColors.muted,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined),    label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.meeting_room_outlined), label: 'Rooms'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), label: 'Alerts'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline),   label: 'Profile'),
        ],
      ),
    );
  }
}
