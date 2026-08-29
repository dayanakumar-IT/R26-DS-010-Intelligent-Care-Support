import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../store/auth_store.dart';
import '../../widgets/module_switcher_pill.dart';
import 'live_room_screen.dart';

const _bg      = AppColors.bgDark;
const _surface = AppColors.surfaceDark;
const _border  = AppColors.borderDark;
const _text    = AppColors.textDark;
const _muted   = AppColors.mutedDark;
const _dim     = AppColors.dimDark;

class RoomsScreen extends ConsumerWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [
          // ── Header ─────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Live Rooms',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _text)),
                Text('Your assigned patients', style: TextStyle(fontSize: 11, color: _muted)),
              ]),
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.low.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.low.withValues(alpha: 0.35)),
                  ),
                  child: Row(children: [
                    Container(width: 6, height: 6,
                        decoration: const BoxDecoration(color: AppColors.low, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text('LIVE', style: TextStyle(
                        fontSize: 10, color: AppColors.low, fontWeight: FontWeight.w800)),
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
                  return const Center(
                      child: CircularProgressIndicator(color: AppColors.accentBlue, strokeWidth: 2));
                }
                final patients = snap.data ?? [];
                if (patients.isEmpty) {
                  return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.meeting_room_outlined, size: 48, color: _dim),
                    const SizedBox(height: 12),
                    Text('No rooms assigned.', style: TextStyle(color: _muted, fontSize: 13)),
                  ]));
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  itemCount: patients.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
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

  void _goLive(BuildContext context) {
    Navigator.push(context,
        MaterialPageRoute(builder: (_) => LiveRoomScreen(
          roomId: patient['room_id']?.toString() ?? '',
          patientCode: patient['patient_code']?.toString() ?? '',
        )));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _goLive(context),
      child: Container(
        decoration: BoxDecoration(
          color: _surface,
          border: Border.all(color: _border),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(children: [
          // ── Card header ────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentBlue.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text('${patient['room_id'] ?? '—'} · ${patient['patient_code'] ?? '—'}',
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700,
                        color: AppColors.accentBlue)),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: AppColors.low.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.low.withValues(alpha: 0.4))),
                child: Row(children: [
                  Container(width: 5, height: 5,
                      decoration: const BoxDecoration(color: AppColors.low, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text('MONITORING',
                      style: TextStyle(color: AppColors.low, fontSize: 9, fontWeight: FontWeight.w800)),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 10),

          // ── Skeleton canvas ────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Container(
              width: double.infinity, height: 90,
              decoration: BoxDecoration(
                color: const Color(0xFF060D1A),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _border),
              ),
              child: CustomPaint(
                painter: _StickFigurePainter(),
                child: const SizedBox.expand(),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // ── Info row ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Risk Score', style: TextStyle(fontSize: 10, color: _muted)),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('—', style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.low)),
                  Text('/100', style: TextStyle(fontSize: 10, color: _dim)),
                ]),
                Text('Tap to view live',
                    style: TextStyle(fontSize: 10, color: AppColors.accentBlue,
                        fontWeight: FontWeight.w600)),
              ]),
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(patient['gender'] ?? '—', style: TextStyle(fontSize: 11, color: _muted)),
                if (patient['age'] != null) ...[
                  const SizedBox(height: 2),
                  Text('Age: ${patient['age']}', style: TextStyle(fontSize: 11, color: _dim)),
                ],
              ]),
            ]),
          ),
          const SizedBox(height: 10),

          // ── View details button ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _goLive(context),
                icon: const Icon(Icons.monitor_heart_outlined, size: 15),
                label: const Text('View Room / Bed Details',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accentBlue,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Stick figure painter ─────────────────────────────────────────────────────
class _StickFigurePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final paint = Paint()..strokeWidth = 2.5..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

    // Head
    paint.color = const Color(0xFFFFD700);
    canvas.drawCircle(Offset(cx, 16), 10, paint);

    // Body
    paint.color = Colors.white;
    canvas.drawLine(Offset(cx, 26), Offset(cx, 55), paint);

    // Arms
    paint.color = const Color(0xFF60A5FA);
    canvas.drawLine(Offset(cx - 22, 36), Offset(cx + 22, 36), paint);

    // Legs
    paint.color = const Color(0xFF22C55E);
    canvas.drawLine(Offset(cx, 55), Offset(cx - 16, 80), paint);
    canvas.drawLine(Offset(cx, 55), Offset(cx + 16, 80), paint);
  }
  @override
  bool shouldRepaint(_) => false;
}
