import 'package:flutter/material.dart';
import '../core/constants/colors.dart';
import '../features/scribe/scribe_home_screen.dart';
import '../features/scribe/scribe_tasks_screen.dart';
import '../features/scribe/scribe_alerts_screen.dart';
import '../features/scribe/scribe_profile_screen.dart';

class ScribeNav extends StatefulWidget {
  const ScribeNav({super.key});
  @override
  State<ScribeNav> createState() => _ScribeNavState();
}

class _ScribeNavState extends State<ScribeNav> {
  int _index = 0;

  final List<Widget> _screens = const [
    ScribeHomeScreen(),
    ScribeTasksScreen(),
    ScribeAlertsScreen(),
    ScribeProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_index],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.scribe,
        unselectedItemColor: AppColors.mutedLight,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined),       label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.checklist_rounded),   label: 'Tasks'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), label: 'Alerts'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline),      label: 'Profile'),
        ],
      ),
    );
  }
}
