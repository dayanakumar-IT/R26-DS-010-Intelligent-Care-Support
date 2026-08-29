import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../store/auth_store.dart';
import '../../widgets/module_switcher_pill.dart';
import 'patient_detail_screen.dart';

class RoomsScreen extends ConsumerWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(children: [
          // ── Header ─────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Live Rooms',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textLight)),
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.low.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.low.withValues(alpha: 0.3)),
                  ),
                  child: Row(children: [
                    Container(width: 6, height: 6,
                        decoration: const BoxDecoration(color: AppColors.low, shape: BoxShape.circle)),
                    const SizedBox(width: 4),
                    Text('LIVE', style: TextStyle(fontSize: 10, color: AppColors.low, fontWeight: FontWeight.w700)),
                  ]),
                ),
                const SizedBox(width: 8),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // ── Patient/Room list ───────────────────────────────────────────
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: SentryService.getPatients(caregiverId: auth.caregiverId),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                }
                final patients = snap.data ?? [];
                if (patients.isEmpty) {
                  return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.meeting_room_outlined, size: 40, color: AppColors.mutedLight),
                    const SizedBox(height: 8),
                    Text('No rooms assigned.', style: TextStyle(color: AppColors.mutedLight, fontSize: 13)),
                  ]));
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: patients.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _RoomCard(patients[i]),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

class _RoomCard extends StatelessWidget {
  final Map<String, dynamic> patient;
  const _RoomCard(this.patient);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => PatientDetailScreen(patient: patient))),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          border: Border.all(color: AppColors.borderLight),
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Room header
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('← ${patient['room_id'] ?? '—'} · ${patient['patient_code'] ?? '—'}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
            ),
            const Spacer(),
            // Live risk badge (placeholder — NORMAL until live data)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: AppColors.low, borderRadius: BorderRadius.circular(6)),
              child: const Text('NORMAL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
            ),
          ]),
          const SizedBox(height: 10),

          // Stick figure placeholder
          Container(
            width: double.infinity, height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFF0D1B2E),
              borderRadius: BorderRadius.circular(8),
            ),
            child: CustomPaint(painter: _StickFigurePainter(), child: const SizedBox.expand()),
          ),
          const SizedBox(height: 10),

          // Risk score row
          Row(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Risk Score', style: TextStyle(fontSize: 10, color: AppColors.mutedLight)),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('—', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.low)),
                Text('/100', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
              ]),
              Text('Monitoring', style: TextStyle(fontSize: 10, color: AppColors.low, fontWeight: FontWeight.w600)),
            ]),
            const Spacer(),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${patient['gender'] ?? '—'}', style: TextStyle(fontSize: 11, color: AppColors.mutedLight)),
              const SizedBox(height: 4),
              Text('Confidence —', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
            ]),
          ]),
          const SizedBox(height: 10),

          // View details button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => PatientDetailScreen(patient: patient))),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('View Room / Bed Details', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    );
  }
}

// Simple stick figure painter
class _StickFigurePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final paint = Paint()..strokeWidth = 2..style = PaintingStyle.stroke;

    // Head
    paint.color = const Color(0xFFFFD700);
    canvas.drawCircle(Offset(cx, 12), 8, paint);

    // Body
    paint.color = Colors.white;
    canvas.drawLine(Offset(cx, 20), Offset(cx, 50), paint);

    // Arms
    paint.color = const Color(0xFF60A5FA);
    canvas.drawLine(Offset(cx - 18, 30), Offset(cx + 18, 30), paint);

    // Legs
    paint.color = const Color(0xFFEF4444);
    canvas.drawLine(Offset(cx, 50), Offset(cx - 14, 72), paint);
    canvas.drawLine(Offset(cx, 50), Offset(cx + 14, 72), paint);
  }
  @override
  bool shouldRepaint(_) => false;
}
