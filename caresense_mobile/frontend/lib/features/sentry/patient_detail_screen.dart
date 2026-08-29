import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import 'event_replay_screen.dart';

class PatientDetailScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  const PatientDetailScreen({super.key, required this.patient});
  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  late Future<List<Map<String, dynamic>>> _historyFuture;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _historyFuture = SentryService.getPatientHistory(
        widget.patient['id'].toString());
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final p = widget.patient;
    final roomId = p['room_id'] ?? '—';
    final code   = p['patient_code'] ?? '—';
    final gender = p['gender'] ?? '—';

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(children: [
          // ── Header ─────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.surfaceLight,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Row(children: [
                    const Icon(Icons.arrow_back_ios_rounded, size: 16, color: AppColors.primary),
                    Text('$roomId – $code',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  ]),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.low, borderRadius: BorderRadius.circular(6)),
                  child: const Text('NORMAL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ]),
              const SizedBox(height: 4),
              Text('$code · Age — · $gender',
                  style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
            ]),
          ),

          // ── Tab bar ────────────────────────────────────────────────
          Container(
            color: AppColors.surfaceLight,
            child: TabBar(
              controller: _tabs,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.mutedLight,
              indicatorColor: AppColors.primary,
              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              tabs: const [Tab(text: 'Overview'), Tab(text: 'History'), Tab(text: 'Notes')],
            ),
          ),

          // ── Tab content ────────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                // Overview
                SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Risk score trend (static visual)
                    _SectionCard(
                      title: 'Risk Score Trend (Last 1hr)',
                      child: SizedBox(
                        height: 80,
                        child: CustomPaint(painter: _TrendPainter()),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Key metrics
                    _SectionCard(
                      title: 'Key Metrics',
                      child: Column(children: [
                        _MetricRow('Body Sway',      '—', AppColors.mutedLight),
                        _MetricRow('Body Tilt',      '—', AppColors.mutedLight),
                        _MetricRow('Movement Level', '—', AppColors.mutedLight),
                        _MetricRow('Instability',    '—', AppColors.mutedLight),
                        _MetricRow('Zone',           '—', AppColors.primary),
                      ]),
                    ),
                    const SizedBox(height: 12),

                    // Replay button
                    FutureBuilder<List<Map<String, dynamic>>>(
                      future: SentryService.getAlerts(unackedOnly: false),
                      builder: (context, snap) {
                        final alerts = snap.data ?? [];
                        final lastAlert = alerts.isNotEmpty ? alerts.first : null;
                        return SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                            label: const Text('View Replay (5 Sec)',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                            onPressed: lastAlert == null ? null : () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => EventReplayScreen(alert: lastAlert)),
                            ),
                          ),
                        );
                      },
                    ),
                  ]),
                ),

                // History
                FutureBuilder<List<Map<String, dynamic>>>(
                  future: _historyFuture,
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                    }
                    final events = snap.data ?? [];
                    if (events.isEmpty) return Center(
                      child: Text('No history yet.', style: TextStyle(color: AppColors.mutedLight)));
                    return ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: events.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final e = events[i];
                        final level = e['risk_level'] ?? 'NORMAL';
                        final color = level == 'HIGH' ? AppColors.high
                                    : level == 'MODERATE' ? AppColors.moderate : AppColors.low;
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLight,
                            border: Border.all(color: AppColors.borderLight),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(children: [
                            Container(width: 8, height: 8,
                                decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                            const SizedBox(width: 10),
                            Expanded(child: Text(
                              'Score: ${(e['risk_score'] ?? 0.0).toStringAsFixed(3)} · $level',
                              style: const TextStyle(fontSize: 12, color: AppColors.textLight),
                            )),
                            Text(
                              (e['timestamp'] ?? '').toString().length >= 16
                                  ? (e['timestamp'] ?? '').toString().substring(11, 16) : '—',
                              style: TextStyle(fontSize: 10, color: AppColors.dimLight),
                            ),
                          ]),
                        );
                      },
                    );
                  },
                ),

                // Notes
                Center(child: Text('Notes coming soon.', style: TextStyle(color: AppColors.mutedLight))),
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
        color: AppColors.surfaceLight,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textLight)),
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
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text(label, style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
        const Spacer(),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: valueColor)),
      ]),
    );
  }
}

class _TrendPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.high
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final path = Path();
    final pts = [0.3, 0.25, 0.28, 0.35, 0.4, 0.55, 0.65, 0.72, 0.68, 0.75];
    for (int i = 0; i < pts.length; i++) {
      final x = size.width * i / (pts.length - 1);
      final y = size.height * (1 - pts[i]);
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    canvas.drawPath(path, paint);

    // Fill under
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()
      ..color = AppColors.high.withValues(alpha: 0.1)
      ..style = PaintingStyle.fill);
  }
  @override
  bool shouldRepaint(_) => false;
}
