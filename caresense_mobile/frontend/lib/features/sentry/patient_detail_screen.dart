import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import 'event_replay_screen.dart';

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

class PatientDetailScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  const PatientDetailScreen({super.key, required this.patient});
  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  Future<List<Map<String, dynamic>>>? _historyFuture;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this); // Overview + History only
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    var id = widget.patient['id'];

    // If id not passed, look it up from Supabase using patient_code
    if (id == null) {
      final code = widget.patient['patient_code']?.toString();
      if (code != null && code.isNotEmpty) {
        try {
          final res = await Supabase.instance.client
              .from('patients')
              .select('id')
              .eq('patient_code', code)
              .maybeSingle();
          id = res?['id'];
        } catch (_) {}
      }
    }

    if (id != null && mounted) {
      setState(() {
        _historyFuture = SentryService.getPatientHistory(id.toString());
      });
    }
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final p      = widget.patient;
    final roomId = p['room_id']      ?? '--';
    final code   = p['patient_code'] ?? '--';
    final gender = p['gender']       ?? '--';

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [

          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: _surface,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Row(children: [
                    const Icon(Icons.arrow_back_ios_rounded, size: 16, color: AppColors.accentBlue),
                    Text('$roomId - $code',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                            color: AppColors.accentBlue)),
                  ]),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.high.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.high.withValues(alpha: 0.4)),
                  ),
                  child: const Text('HIGH',
                      style: TextStyle(color: AppColors.high, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ]),
              const SizedBox(height: 4),
              Text('$code - $gender', style: TextStyle(fontSize: 12, color: _muted)),
            ]),
          ),

          // Tab bar — Overview + History only (Notes removed)
          Container(
            color: _surface,
            child: TabBar(
              controller: _tabs,
              labelColor: AppColors.accentBlue,
              unselectedLabelColor: _dim,
              indicatorColor: AppColors.accentBlue,
              dividerColor: _border,
              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              tabs: const [Tab(text: 'Overview'), Tab(text: 'History')],
            ),
          ),

          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [

                // ── OVERVIEW ────────────────────────────────────────────────
                SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Risk score trend
                    _SectionCard(
                      title: 'Risk Score Trend (Last 1hr)',
                      child: SizedBox(height: 90, child: CustomPaint(painter: _TrendPainter())),
                    ),
                    const SizedBox(height: 12),

                    // Key metrics
                    _SectionCard(
                      title: 'Key Metrics',
                      child: Column(children: [
                        _MetricRow('Body Sway',      'High',     AppColors.high),
                        _MetricRow('Body Tilt',      'High',     AppColors.high),
                        _MetricRow('Movement Level', 'Moderate', AppColors.moderate),
                        _MetricRow('Instability',    'High',     AppColors.high),
                        _MetricRow('Zone',           'Bed Edge', AppColors.accentBlue),
                      ]),
                    ),
                    const SizedBox(height: 12),

                    // Replay button
                    FutureBuilder<List<Map<String, dynamic>>>(
                      future: SentryService.getAlerts(unackedOnly: false),
                      builder: (context, snap) {
                        final alerts = snap.data ?? [];
                        final lastAlert = alerts.isNotEmpty ? alerts.first : <String, dynamic>{};
                        return SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.accentBlue,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.play_arrow_rounded, size: 18),
                            label: const Text('View Replay (5 Sec)',
                                style: TextStyle(fontWeight: FontWeight.w700)),
                            onPressed: () => Navigator.push(context,
                                MaterialPageRoute(builder: (_) =>
                                    EventReplayScreen(alert: lastAlert))),
                          ),
                        );
                      },
                    ),
                  ]),
                ),

                // ── HISTORY ─────────────────────────────────────────────────
                _historyFuture == null
                  ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const CircularProgressIndicator(color: AppColors.accentBlue, strokeWidth: 2),
                      const SizedBox(height: 12),
                      Text('Loading history...', style: TextStyle(color: _muted, fontSize: 13)),
                    ]))
                  : FutureBuilder<List<Map<String, dynamic>>>(
                      future: _historyFuture,
                      builder: (context, snap) {
                        if (snap.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator(
                              color: AppColors.accentBlue, strokeWidth: 2));
                        }
                        final events = snap.data ?? [];
                        if (events.isEmpty) {
                          return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.history_rounded, size: 40, color: _dim),
                            const SizedBox(height: 8),
                            Text('No history yet.', style: TextStyle(color: _muted, fontSize: 13)),
                          ]));
                        }
                        return ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: events.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final e   = events[i];
                            final lvl = (e['risk_level'] ?? 'NORMAL').toString();
                            final col = lvl == 'HIGH' ? AppColors.high
                                      : lvl == 'MODERATE' ? AppColors.moderate
                                      : AppColors.low;
                            final ts  = (e['timestamp'] ?? '').toString();
                            final timeStr = ts.length >= 16 ? ts.substring(11, 16) : '--';
                            final score = e['risk_score'];
                            final scoreStr = score != null
                                ? (score as num).toStringAsFixed(1)
                                : '--';
                            return Container(
                              decoration: BoxDecoration(
                                color: _surface,
                                border: Border.all(color: _border),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: IntrinsicHeight(
                                child: Row(children: [
                                  Container(width: 4, color: col),
                                  Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                      child: Row(children: [
                                        Container(width: 7, height: 7,
                                            decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
                                        const SizedBox(width: 10),
                                        Expanded(child: Text(
                                          'Score: $scoreStr - $lvl',
                                          style: TextStyle(fontSize: 12, color: _text),
                                        )),
                                        Text(timeStr, style: TextStyle(fontSize: 10, color: _dim)),
                                      ]),
                                    ),
                                  ),
                                ]),
                              ),
                            );
                          },
                        );
                      },
                    ),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _text)),
        const SizedBox(height: 10),
        child,
      ]),
    );
  }
}

class _MetricRow extends StatelessWidget {
  final String label, value;
  final Color valueColor;
  const _MetricRow(this.label, this.value, this.valueColor);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Text(label, style: TextStyle(fontSize: 12, color: _muted)),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: valueColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(value,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: valueColor)),
        ),
      ]),
    );
  }
}

class _TrendPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Light-theme grid
    final gridP = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;
    for (double y = 0; y <= size.height; y += size.height / 4) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridP);
    }

    // Trend line (rising risk demo data)
    final pts = [0.20, 0.22, 0.25, 0.32, 0.40, 0.55, 0.62, 0.70, 0.75, 0.82];
    final path = Path();
    for (int i = 0; i < pts.length; i++) {
      final x = size.width * i / (pts.length - 1);
      final y = size.height * (1 - pts[i]);
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }

    // Fill
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [AppColors.high.withValues(alpha: 0.18), Colors.transparent],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill);

    // Line
    canvas.drawPath(path, Paint()
      ..color = AppColors.high
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke);

    // End dot
    final lastX = size.width;
    final lastY = size.height * (1 - pts.last);
    canvas.drawCircle(Offset(lastX, lastY), 5, Paint()..color = AppColors.high);
    canvas.drawCircle(Offset(lastX, lastY), 5,
        Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 1.5);
  }
  @override
  bool shouldRepaint(_) => false;
}
