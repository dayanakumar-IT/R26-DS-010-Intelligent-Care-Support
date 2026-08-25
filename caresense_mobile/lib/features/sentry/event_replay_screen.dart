import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class EventReplayScreen extends StatelessWidget {
  final String alertId;
  const EventReplayScreen({super.key, required this.alertId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, foregroundColor: AppColors.text, title: const Text('Event Replay')),
      body: const Center(child: Text('5-second skeleton replay — TODO', style: TextStyle(color: AppColors.muted))),
    );
  }
}
