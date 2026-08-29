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
      // Query Supabase directly:
      // 1. Get rooms where caregiver_id IS NOT NULL (assigned rooms)
      // 2. Get patients in those rooms
      // rooms.caregiver_id stores caregiver_profiles UUID (set by web dashboard
      // via PATCH /api/rooms/:id/caregiver). We filter IS NOT NULL rather than
      // matching auth UUID since they differ in schema.
      final db = Supabase.instance.client;

      final roomsRes = await db
          .from('rooms')
          .select('room_code, ward, caregiver_id')
          .not('caregiver_id', 'is', null);

      final roomCodes = (roomsRes as List)
          .map((r) => r['room_code'].toString())
          .toList();

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
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Live Rooms',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _text)),
                Text('Your assigned patients', style: TextStyle(fontSize: 11, color: _muted)),
              ]),
              Row(children: [
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.mutedLight),
                  onPressed: _load,
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.low.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.low.withOpacity(0.35)),
                  ),
                  child: Row(children: [
                    Container(width: 6, height: 6,
                        decoration: const BoxDecoration(color: AppColors.low, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text('LIVE', style: TextStyle(fontSize: 10, color: AppColors.low, fontWeight: FontWeight.w800)),
                  ]),
                ),
                const SizedBox(width: 8),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // Patient/Room list
          Expanded(
            child: _patients == null
                ? const Center(child: CircularProgressIndicator(color: AppColors.accentBlue, strokeWidth: 2))
                : _patients!.isEmpty
                    ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.meeting_room_outlined, size: 48, color: AppColors.dimLight),
                        const SizedBox(height: 12),
                        Text(_error != null ? 'Connection error' : 'No rooms assigned.',
                            style: TextStyle(color: _muted, fontSize: 13)),
                        if (_error != null) ...[
                          const SizedBox(height: 4),
                          Text(_error!, style: TextStyle(color: _dim, fontSize: 10),
                              textAlign: TextAlign.center),
                        ],
                        const SizedBox(height: 16),
                        TextButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded, size: 16, color: AppColors.accentBlue),
                          label: const Text('Retry', style: TextStyle(color: AppColors.accentBlue)),
                        ),
                      ]))
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        itemCount: _patients!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) => _RoomCard(_patients![i]),
                      ),
          ),
        ]),
      ),
    );
  }
}

// ── Room/Patient card ──────────────────────────────────────────────────────
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

          // Card header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentBlue.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text('${patient['room_id'] ?? '--'} / ${patient['patient_code'] ?? '--'}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                        color: AppColors.accentBlue)),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.low.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.low.withOpacity(0.4)),
                ),
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

          // Skeleton preview canvas
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Container(
              width: double.infinity, height: 90,
              decoration: BoxDecoration(
                color: AppColors.bgLight,
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

          // Info row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Risk Score', style: TextStyle(fontSize: 10, color: _muted)),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('--', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.low)),
                  Text('/100', style: TextStyle(fontSize: 10, color: _dim)),
                ]),
                Text('Tap to view live',
                    style: TextStyle(fontSize: 10, color: AppColors.accentBlue, fontWeight: FontWeight.w600)),
              ]),
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                if (patient['gender'] != null)
                  Text(patient['gender'] ?? '', style: TextStyle(fontSize: 11, color: _muted)),
                if (patient['age'] != null) ...[
                  const SizedBox(height: 2),
                  Text('Age: ${patient['age']}', style: TextStyle(fontSize: 11, color: _dim)),
                ],
              ]),
            ]),
          ),
          const SizedBox(height: 10),

          // View details button
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

// ── Stick figure painter ────────────────────────────────────────────────────
class _StickFigurePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final p = Paint()..strokeWidth = 2.5..style = PaintingStyle.stroke..strokeCap = StrokeCap.round;
    p.color = const Color(0xFFFFD700);
    canvas.drawCircle(Offset(cx, 16), 10, p);
    p.color = Colors.white;
    canvas.drawLine(Offset(cx, 26), Offset(cx, 55), p);
    p.color = const Color(0xFF60A5FA);
    canvas.drawLine(Offset(cx - 22, 36), Offset(cx + 22, 36), p);
    p.color = const Color(0xFF22C55E);
    canvas.drawLine(Offset(cx, 55), Offset(cx - 16, 80), p);
    canvas.drawLine(Offset(cx, 55), Offset(cx + 16, 80), p);
  }
  @override
  bool shouldRepaint(_) => false;
}
