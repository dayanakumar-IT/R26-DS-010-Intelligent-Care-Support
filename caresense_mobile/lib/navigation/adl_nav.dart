import 'package:flutter/material.dart';
import '../core/constants/colors.dart';
import '../features/adl/adl_home_screen.dart';
import '../features/adl/tasks_screen.dart';
import '../features/adl/adl_alerts_screen.dart';
import '../features/adl/adl_profile_screen.dart';

class AdlNav extends StatefulWidget {
  const AdlNav({super.key});
  @override
  State<AdlNav> createState() => _AdlNavState();
}

class _AdlNavState extends State<AdlNav> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    AdlHomeScreen(),
    TasksScreen(),
    AdlAlertsScreen(),
    AdlProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.adlGreen,
        unselectedItemColor: AppColors.muted,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined),       label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.checklist_outlined),  label: 'Tasks'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), label: 'Alerts'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline),      label: 'Profile'),
        ],
      ),
    );
  }
}
