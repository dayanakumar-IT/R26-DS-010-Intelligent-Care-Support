import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/colors.dart';
import '../../widgets/module_switcher_pill.dart';
import 'live_room_screen.dart';

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

class RoomsScreen extends StatefulWidget {
  const RoomsScreen({super.key});
  @override
  State<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends State<RoomsScreen> {
  List<Map<String, dynamic>>? _patients;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _patients = null; _error = null; });
    try {
      final db     = Supabase.instance.client;
      final authId = db.auth.currentUser?.id;

      String? syntheticCgId;
      if (authId != null) {
        final profileRes = await db.from('profiles').select('name')
            .eq('id', authId).maybeSingle();
        final realName = profileRes?['name']?.toString();
        if (realName != null && realName.isNotEmpty) {
          final cgRes = await db.from('caregiver_profiles').select('id')
              .ilike('display_name', '%$realName%').limit(1).maybeSingle();
          syntheticCgId = cgRes?['id']?.toString();
        }
      }

      List<dynamic> roomsRes = syntheticCgId != null
          ? await db.from('rooms').select('room_code, ward, caregiver_id')
              .eq('caregiver_id', syntheticCgId)
          : [];

      if (roomsRes.isEmpty) {
        roomsRes = await db.from('rooms').select('room_code, ward, caregiver_id');
      }

      final roomCodes = roomsRes.map((r) => r['room_code'].toString()).toList();
      if (roomCodes.isEmpty) {
        if (mounted) setState(() => _patients = []);
        return;
      }

      final patientsRes = await db
          .from('patients')
          .select('id, patient_code, room_id, gender')
          .inFilter('room_id', roomCodes)
          .order('room_id');

      if (mounted) {
        setState(() => _patients = (patientsRes as List)
            .map((p) => Map<String, dynamic>.from(p as Map))
            .toList());
      }
    } catch (e) {
      if (mounted) setState(() { _patients = []; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = _patients?.length ?? 0;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [

          // ── Header ──────────────────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: _surface,
              boxShadow: [BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8, offset: const Offset(0, 2))],
            ),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Text('Live Rooms',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800,
                          color: _text)),
                  if (_patients != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.accentBlue.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text('$count',
                          style: const TextStyle(fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.accentBlue)),
                    ),
                  ],
                ]),
                Text('Your assigned patients',
                    style: TextStyle(fontSize: 11, color: _muted)),
              ]),
              Row(children: [
                // Live badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.low.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.low.withValues(alpha: 0.35)),
                  ),
                  child: Row(children: [
                    Container(width: 6, height: 6,
                        decoration: const BoxDecoration(
                            color: AppColors.low, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    const Text('LIVE',
                        style: TextStyle(fontSize: 10, color: AppColors.low,
                            fontWeight: FontWeight.w800)),
                  ]),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _load,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _bg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _border),
                    ),
                    child: Icon(Icons.refresh_rounded, size: 18, color: _muted),
                  ),
                ),
                const SizedBox(width: 8),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // ── List ────────────────────────────────────────────────────────
          Expanded(
            child: _patients == null
                ? const Center(child: CircularProgressIndicator(
                    color: AppColors.accentBlue, strokeWidth: 2))
                : _patients!.isEmpty
                    ? _EmptyState(error: _error, onRetry: _load)
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        itemCount: _patients!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 14),
                        itemBuilder: (_, i) => _RoomCard(_patients![i]),
                      ),
          ),
        ]),
      ),
    );
  }
}

// ── Empty state ──────────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final String? error;
  final VoidCallback onRetry;
  const _EmptyState({this.error, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            color: AppColors.accentBlue.withValues(alpha: 0.08),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.meeting_room_outlined,
              size: 40, color: AppColors.accentBlue),
        ),
        const SizedBox(height: 16),
        Text(error != null ? 'Connection error' : 'No rooms assigned',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800,
                color: _text)),
        const SizedBox(height: 6),
        Text(error != null ? error! : 'No patients are currently assigned to you.',
            style: TextStyle(fontSize: 12, color: _muted),
            textAlign: TextAlign.center),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded, size: 16),
          label: const Text('Retry'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.accentBlue,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ]),
    ),
  );
}

// ── Room card ────────────────────────────────────────────────────────────────
class _RoomCard extends StatelessWidget {
  final Map<String, dynamic> patient;
  const _RoomCard(this.patient);

  void _goLive(BuildContext context) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => LiveRoomScreen(
      roomId: patient['room_id']?.toString() ?? '',
      patientCode: patient['patient_code']?.toString() ?? '',
    )));
  }

  @override
  Widget build(BuildContext context) {
    final roomId = patient['room_id']?.toString() ?? '--';
    final code   = patient['patient_code']?.toString() ?? '--';
    final gender = patient['gender']?.toString();

    return GestureDetector(
      onTap: () => _goLive(context),
      child: Container(
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(
            color: AppColors.accentBlue.withValues(alpha: 0.08),
            blurRadius: 14, offset: const Offset(0, 5))],
        ),
        child: Column(children: [

          // Gradient top strip header
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1A56DB), Color(0xFF0891B2)],
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.bed_rounded, color: Colors.white70, size: 14),
                  const SizedBox(width: 4),
                  Text('Room $roomId',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800,
                          color: Colors.white)),
                ]),
                const SizedBox(height: 2),
                Text('Patient: $code',
                    style: const TextStyle(fontSize: 11, color: Colors.white70)),
              ]),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(children: [
                  Container(width: 5, height: 5,
                      decoration: const BoxDecoration(
                          color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  const Text('MONITORING',
                      style: TextStyle(fontSize: 9, color: Colors.white,
                          fontWeight: FontWeight.w800)),
                ]),
              ),
            ]),
          ),

          // Skeleton preview
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: Container(
              width: double.infinity, height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFF060D1A),
                borderRadius: BorderRadius.circular(10),
              ),
              child: CustomPaint(
                painter: _StickFigurePainter(),
                child: const SizedBox.expand(),
              ),
            ),
          ),

          // Info row
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
            child: Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Risk Score',
                    style: TextStyle(fontSize: 9, color: _muted,
                        fontWeight: FontWeight.w600)),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  const Text('--',
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900,
                          color: AppColors.low, height: 1.0)),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text('/100',
                        style: TextStyle(fontSize: 10, color: _dim)),
                  ),
                ]),
              ]),
              const Spacer(),
              if (gender != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.accentBlue.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(children: [
                    Icon(gender == 'Male' ? Icons.male : Icons.female,
                        size: 14, color: AppColors.accentBlue),
                    const SizedBox(width: 3),
                    Text(gender,
                        style: const TextStyle(fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.accentBlue)),
                  ]),
                ),
            ]),
          ),

          // Button
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _goLive(context),
                icon: const Icon(Icons.monitor_heart_rounded, size: 16),
                label: const Text('View Live Room',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accentBlue,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Static stick figure on dark bg ──────────────────────────────────────────
class _StickFigurePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final scale = size.height / 100;
    final p = Paint()..strokeWidth = 2.5 * scale
        ..style = PaintingStyle.stroke..strokeCap = StrokeCap.round;

    // Head
    canvas.drawCircle(Offset(cx, 18 * scale), 10 * scale,
        Paint()..color = const Color(0xFFFCD34D)..style = PaintingStyle.stroke..strokeWidth = 2.5);
    // Body
    p.color = const Color(0xFF60A5FA);
    canvas.drawLine(Offset(cx, 28 * scale), Offset(cx, 60 * scale), p);
    // Arms
    p.color = const Color(0xFF34D399);
    canvas.drawLine(Offset(cx - 22 * scale, 40 * scale),
        Offset(cx + 22 * scale, 40 * scale), p);
    // Legs
    p.color = const Color(0xFF818CF8);
    canvas.drawLine(Offset(cx, 60 * scale), Offset(cx - 18 * scale, 88 * scale), p);
    canvas.drawLine(Offset(cx, 60 * scale), Offset(cx + 18 * scale, 88 * scale), p);
  }
  @override
  bool shouldRepaint(_) => false;
}
