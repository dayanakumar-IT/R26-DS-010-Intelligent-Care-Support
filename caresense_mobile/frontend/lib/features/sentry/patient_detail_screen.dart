import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import 'event_replay_screen.dart';

const _bg      = AppColors.bgDark;
const _surface = AppColors.surfaceDark;
const _border  = AppColors.borderDark;
const _text    = AppColors.textDark;
const _muted   = AppColors.mutedDark;
const _dim     = AppColors.dimDark;

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
    _tabs = TabController(length: 3, vsync: this);
    final id = widget.patient['id'];
    if (id != null) {
      _historyFuture = SentryService.getPatientHistory(id.toString());
    }
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final p      = widget.patient;
    final roomId = p['room_id']      ?? 'â€”';
    final code   = p['patient_code'] ?? 'â€”';
    final gender = p['gender']       ?? 'â€”';
    final age    = p['age'];

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [
          // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: _surface,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Row(children: [
                    const Icon(Icons.arrow_back_ios_rounded, size: 16, color: AppColors.accentBlue),
                    Text('$roomId â€“ $code',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                            color: AppColors.accentBlue)),
                  ]),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.high.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.high.withOpacity(0.4)),
                  ),
                  child: const Text('HIGH',
                      style: TextStyle(color: AppColors.high, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ]),
              const SizedBox(height: 4),
              Text('$code Â· ${age != null ? 'Age: $age Â· ' : ''}$gender',
                  style: TextStyle(fontSize: 12, color: _muted)),
            ]),
          ),

          // â”€â”€ Tab bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Container(
            color: _surface,
            child: TabBar(
              controller: _tabs,
              labelColor: AppColors.accentBlue,
              unselectedLabelColor: _dim,
              indicatorColor: AppColors.accentBlue,
              dividerColor: _border,
              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              tabs: const [Tab(text: 'Overview'), Tab(text: 'History'), Tab(text: 'Notes')],
            ),
          ),

          // â”€â”€ Tab content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                // â”€â”€ OVERVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Risk score trend
                    _SectionCard(
                      title: 'Risk Score Trend (Last 1hr)',
                      child: SizedBox(
                        height: 90,
                        child: CustomPaint(painter: _TrendPainter()),
                      ),
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

                    // Last alert + replay
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
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
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

                // â”€â”€ HISTORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                _historyFuture == null
                  ? Center(child: Text('No patient ID.', style: TextStyle(color: _muted)))
                  : FutureBuilder<List<Map<String, dynamic>>>(
                      future: _historyFuture,
                      builder: (context, snap) {
                        if (snap.connectionState == ConnectionState.waiting) {
                          return const Center(
                              child: CircularProgressIndicator(
                                  color: AppColors.accentBlue, strokeWidth: 2));
                        }
                        final events = snap.data ?? [];
                        if (events.isEmpty) {
                          return Center(child: Text('No history yet.',
                              style: TextStyle(color: _muted, fontSize: 13)));
                        }
                        return ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: events.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final e = events[i];
                            final lvl = e['risk_level'] ?? 'NORMAL';
                            final col = lvl == 'HIGH' ? AppColors.high
                                      : lvl == 'MODERATE' ? AppColors.moderate
                                      : AppColors.low;
                            final ts = (e['timestamp'] ?? '').toString();
                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: _surface,
                                border: Border(left: BorderSide(color: col, width: 3),
                                    top: BorderSide(color: _border),
                                    right: BorderSide(color: _border),
                                    bottom: BorderSide(color: _border)),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(children: [
                                Container(width: 7, height: 7,
                                    decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
                                const SizedBox(width: 10),
                                Expanded(child: Text(
                                  'Score: ${(e['risk_score'] ?? 0.0).toStringAsFixed(2)} Â· $lvl',
                                  style: TextStyle(fontSize: 12, color: _text),
                                )),
                                Text(
                                  ts.length >= 16 ? ts.substring(11, 16) : 'â€”',
                                  style: TextStyle(fontSize: 10, color: _dim),
                                ),
                              ]),
                            );
                          },
                        );
                      },
                    ),

                // â”€â”€ NOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.note_outlined, size: 40, color: _dim),
                  const SizedBox(height: 8),
                  Text('Clinical notes coming soon.',
                      style: TextStyle(color: _muted, fontSize: 13)),
                ])),
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
        Text(title, style: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.w700, color: _text)),
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
            color: valueColor.withOpacity(0.12),
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
    // Grid
    final gridP = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..strokeWidth = 1;
    for (double y = 0; y <= size.height; y += size.height / 4) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridP);
    }

    // Trend line (rising risk)
    final path = Path();
    final pts = [0.20, 0.22, 0.25, 0.32, 0.40, 0.55, 0.62, 0.70, 0.75, 0.82];
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
        colors: [AppColors.high.withOpacity(0.25), Colors.transparent],
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
        Paint()..color = Colors.white.withOpacity(0.3)
        ..style = PaintingStyle.stroke..strokeWidth = 1.5);
  }
  @override
  bool shouldRepaint(_) => false;
}
