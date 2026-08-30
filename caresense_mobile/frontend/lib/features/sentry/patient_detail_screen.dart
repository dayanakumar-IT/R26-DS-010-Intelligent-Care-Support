import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import 'event_replay_screen.dart';

// ── palette aliases ──────────────────────────────────────────────────────────
const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

// ── hero gradient ────────────────────────────────────────────────────────────
const _heroStart = Color(0xFF1A56DB);
const _heroEnd   = Color(0xFF5B21B6);

// ── risk helpers ─────────────────────────────────────────────────────────────
Color _riskColor(String lvl) {
  switch (lvl.toUpperCase()) {
    case 'HIGH':     return AppColors.high;
    case 'MODERATE': return AppColors.moderate;
    case 'LOW':      return AppColors.low;
    default:         return AppColors.low;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class PatientDetailScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  const PatientDetailScreen({super.key, required this.patient});
  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen>
    with TickerProviderStateMixin {
  late final TabController _tabs;
  late final AnimationController _heroCtrl;
  late final Animation<double>    _heroFade;

  Future<List<Map<String, dynamic>>>? _historyFuture;
  Future<List<Map<String, dynamic>>>? _alertsFuture;

  // live metrics (populated from history / realtime)
  final List<double> _trendPts = [];
  bool _metricExpanded = false;

  @override
  void initState() {
    super.initState();
    _tabs     = TabController(length: 2, vsync: this);
    _heroCtrl = AnimationController(vsync: this,
        duration: const Duration(milliseconds: 600));
    _heroFade = CurvedAnimation(parent: _heroCtrl, curve: Curves.easeOut);
    _heroCtrl.forward();

    _alertsFuture = SentryService.getAlerts(unackedOnly: false);
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    var id = widget.patient['id'];
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
      final future = SentryService.getPatientHistory(id.toString());
      setState(() { _historyFuture = future; });
      // build trend from history
      final data = await future;
      if (mounted && data.isNotEmpty) {
        final pts = data.reversed
            .map((e) => ((e['risk_score'] as num?)?.toDouble() ?? 0.0))
            .toList();
        setState(() { _trendPts
          ..clear()
          ..addAll(pts.length > 20 ? pts.sublist(pts.length - 20) : pts); });
      }
    }
  }

  @override
  void dispose() {
    _tabs.dispose();
    _heroCtrl.dispose();
    super.dispose();
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final p      = widget.patient;
    final roomId = (p['room_id']      ?? '--').toString();
    final code   = (p['patient_code'] ?? '--').toString();
    final gender = (p['gender']       ?? '--').toString();
    final riskLvl = (p['risk_level']  ?? 'HIGH').toString();
    final riskCol = _riskColor(riskLvl);
    final score   = (p['risk_score']  as num?)?.toStringAsFixed(1) ?? '--';

    return Scaffold(
      backgroundColor: _bg,
      body: Column(children: [

        // ── Gradient hero header ─────────────────────────────────────────────
        _HeroHeader(
          roomId: roomId, code: code, gender: gender,
          riskLvl: riskLvl, riskCol: riskCol, score: score,
          fade: _heroFade,
          onBack: () => Navigator.pop(context),
        ),

        // ── Tab bar ──────────────────────────────────────────────────────────
        Container(
          color: _surface,
          child: TabBar(
            controller: _tabs,
            labelColor: AppColors.accentBlue,
            unselectedLabelColor: _dim,
            indicatorColor: AppColors.accentBlue,
            indicatorWeight: 2.5,
            dividerColor: _border,
            labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            unselectedLabelStyle: const TextStyle(fontSize: 13),
            tabs: const [Tab(text: 'Overview'), Tab(text: 'History')],
          ),
        ),

        // ── Tab content ──────────────────────────────────────────────────────
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _OverviewTab(
                trendPts: _trendPts,
                alertsFuture: _alertsFuture,
                expanded: _metricExpanded,
                onExpandToggle: () =>
                    setState(() => _metricExpanded = !_metricExpanded),
              ),
              _HistoryTab(historyFuture: _historyFuture),
            ],
          ),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Header
// ─────────────────────────────────────────────────────────────────────────────

class _HeroHeader extends StatelessWidget {
  final String roomId, code, gender, riskLvl, score;
  final Color  riskCol;
  final Animation<double> fade;
  final VoidCallback onBack;

  const _HeroHeader({
    required this.roomId, required this.code, required this.gender,
    required this.riskLvl, required this.riskCol, required this.score,
    required this.fade, required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: fade,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [_heroStart, _heroEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Stack(children: [

            // decorative circles
            Positioned(top: -20, right: -20,
              child: Container(width: 140, height: 140,
                decoration: BoxDecoration(shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05)))),
            Positioned(bottom: -10, left: -30,
              child: Container(width: 100, height: 100,
                decoration: BoxDecoration(shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.04)))),

            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start, children: [

                // back row
                Row(children: [
                  GestureDetector(
                    onTap: onBack,
                    child: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.15),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.25)),
                      ),
                      child: const Icon(Icons.arrow_back_ios_rounded,
                          size: 15, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('$roomId — $code',
                        style: const TextStyle(fontSize: 15,
                            fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                  // risk badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: riskCol.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: riskCol.withValues(alpha: 0.6), width: 1.2),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(width: 6, height: 6,
                          decoration: BoxDecoration(
                              color: riskCol, shape: BoxShape.circle)),
                      const SizedBox(width: 5),
                      Text(riskLvl.toUpperCase(),
                          style: TextStyle(color: riskCol, fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5)),
                    ]),
                  ),
                ]),

                const SizedBox(height: 16),

                // patient sub-info
                Text('Patient $code  •  $gender',
                    style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.7))),
                const SizedBox(height: 14),

                // stats row
                Row(children: [
                  _HeroStat(
                      icon: Icons.monitor_heart_outlined,
                      label: 'Risk Score',
                      value: score),
                  const SizedBox(width: 12),
                  _HeroStat(
                      icon: Icons.bed_rounded,
                      label: 'Zone',
                      value: 'Bed Edge'),
                  const SizedBox(width: 12),
                  _HeroStat(
                      icon: Icons.access_time_rounded,
                      label: 'Monitoring',
                      value: 'LIVE'),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final IconData icon;
  final String label, value;
  const _HeroStat({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 14, color: Colors.white.withValues(alpha: 0.7)),
          const SizedBox(height: 5),
          Text(label,
              style: TextStyle(fontSize: 9, color: Colors.white.withValues(alpha: 0.6),
                  letterSpacing: 0.4)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800,
                  color: Colors.white)),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final List<double> trendPts;
  final Future<List<Map<String, dynamic>>>? alertsFuture;
  final bool expanded;
  final VoidCallback onExpandToggle;

  const _OverviewTab({
    required this.trendPts,
    required this.alertsFuture,
    required this.expanded,
    required this.onExpandToggle,
  });

  @override
  Widget build(BuildContext context) {
    final demo = trendPts.isEmpty
        ? [0.20, 0.22, 0.25, 0.32, 0.40, 0.55, 0.62, 0.70, 0.75, 0.82]
        : trendPts;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

        // ── Risk Score Trend chart ───────────────────────────────────────────
        _SectionCard(
          title: 'Risk Score Trend',
          subtitle: 'Last 1 hour',
          icon: Icons.show_chart_rounded,
          iconColor: AppColors.high,
          child: SizedBox(
            height: 130,
            child: CustomPaint(
              painter: _TrendPainter(pts: demo),
              size: const Size(double.infinity, 130),
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ── Key Metrics ──────────────────────────────────────────────────────
        _SectionCard(
          title: 'Key Metrics',
          subtitle: 'Current snapshot',
          icon: Icons.bar_chart_rounded,
          iconColor: AppColors.accentBlue,
          trailing: GestureDetector(
            onTap: onExpandToggle,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.accentBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(expanded ? 'Less' : 'More',
                    style: const TextStyle(fontSize: 10,
                        color: AppColors.accentBlue, fontWeight: FontWeight.w700)),
                const SizedBox(width: 2),
                Icon(expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
                    size: 14, color: AppColors.accentBlue),
              ]),
            ),
          ),
          child: Column(children: [
            _MetricBar(label: 'Body Sway',      value: 0.85, level: 'High',     col: AppColors.high),
            _MetricBar(label: 'Body Tilt',      value: 0.78, level: 'High',     col: AppColors.high),
            _MetricBar(label: 'Movement Level', value: 0.52, level: 'Moderate', col: AppColors.moderate),
            _MetricBar(label: 'Instability',    value: 0.80, level: 'High',     col: AppColors.high),
            _MetricBar(label: 'Zone',           value: 1.0,  level: 'Bed Edge', col: AppColors.accentBlue),
            if (expanded) ...[
              _MetricBar(label: 'Gait Speed',   value: 0.30, level: 'Low',      col: AppColors.low),
              _MetricBar(label: 'Step Length',  value: 0.45, level: 'Moderate', col: AppColors.moderate),
            ],
          ]),
        ),
        const SizedBox(height: 12),

        // ── Risk factors chips ───────────────────────────────────────────────
        _SectionCard(
          title: 'Active Risk Factors',
          subtitle: 'Detected this session',
          icon: Icons.warning_amber_rounded,
          iconColor: AppColors.moderate,
          child: Wrap(spacing: 8, runSpacing: 8, children: const [
            _FactorChip(label: 'High body sway',    col: AppColors.high),
            _FactorChip(label: 'Bed edge proximity',col: AppColors.high),
            _FactorChip(label: 'Poor stability',    col: AppColors.high),
            _FactorChip(label: 'Elevated tilt',     col: AppColors.moderate),
            _FactorChip(label: 'Reduced gait speed',col: AppColors.moderate),
          ]),
        ),
        const SizedBox(height: 20),

        // ── View Replay button ───────────────────────────────────────────────
        FutureBuilder<List<Map<String, dynamic>>>(
          future: alertsFuture,
          builder: (context, snap) {
            final alerts   = snap.data ?? [];
            final lastAlert = alerts.isNotEmpty ? alerts.first : <String, dynamic>{};
            final loading  = snap.connectionState == ConnectionState.waiting;
            return GestureDetector(
              onTap: loading ? null : () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) =>
                      EventReplayScreen(alert: lastAlert))),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_heroStart, _heroEnd],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.accentBlue.withValues(alpha: 0.30),
                      blurRadius: 16, offset: const Offset(0, 6)),
                  ],
                ),
                child: loading
                    ? const Center(child: SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white)))
                    : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                          child: const Icon(Icons.play_arrow_rounded,
                              color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Text('View Replay',
                            style: TextStyle(color: Colors.white, fontSize: 15,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('5 sec',
                              style: TextStyle(color: Colors.white,
                                  fontSize: 10, fontWeight: FontWeight.w700)),
                        ),
                      ]),
              ),
            );
          },
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────────────────────────────────────

class _HistoryTab extends StatelessWidget {
  final Future<List<Map<String, dynamic>>>? historyFuture;
  const _HistoryTab({required this.historyFuture});

  @override
  Widget build(BuildContext context) {
    if (historyFuture == null) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const CircularProgressIndicator(color: AppColors.accentBlue, strokeWidth: 2),
        const SizedBox(height: 12),
        Text('Loading history...', style: TextStyle(color: _muted, fontSize: 13)),
      ]));
    }
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: historyFuture,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(
              color: AppColors.accentBlue, strokeWidth: 2));
        }
        final events = snap.data ?? [];
        if (events.isEmpty) {
          return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.accentBlue.withValues(alpha: 0.08)),
              child: Icon(Icons.history_rounded, size: 30,
                  color: AppColors.accentBlue.withValues(alpha: 0.4)),
            ),
            const SizedBox(height: 12),
            Text('No history yet',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700,
                    color: _text)),
            const SizedBox(height: 4),
            Text('Events will appear here once detected.',
                style: TextStyle(fontSize: 12, color: _muted)),
          ]));
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          itemCount: events.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => _HistoryCard(event: events[i]),
        );
      },
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> event;
  const _HistoryCard({required this.event});

  @override
  Widget build(BuildContext context) {
    final lvl      = (event['risk_level'] ?? 'NORMAL').toString();
    final col      = _riskColor(lvl);
    final ts       = (event['timestamp'] ?? '').toString();
    final timeStr  = ts.length >= 19 ? ts.substring(11, 19) : '--';
    final dateStr  = ts.length >= 10 ? ts.substring(0, 10) : '';
    final score    = event['risk_score'];
    final scoreStr = score != null
        ? (score as num).toStringAsFixed(1)
        : '--';

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
            color: col.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(children: [
          // accent stripe
          Container(width: 4, color: col),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(children: [
                // icon circle
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: col.withValues(alpha: 0.1),
                  ),
                  child: Icon(
                    lvl == 'HIGH' ? Icons.warning_rounded
                        : lvl == 'MODERATE' ? Icons.info_outline_rounded
                        : Icons.check_circle_outline_rounded,
                    size: 16, color: col),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('Risk: $scoreStr',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                            color: _text))),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: col.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Text(lvl,
                          style: TextStyle(fontSize: 9,
                              fontWeight: FontWeight.w800, color: col)),
                    ),
                  ]),
                  const SizedBox(height: 3),
                  Text(dateStr.isEmpty ? timeStr : '$dateStr  $timeStr',
                      style: TextStyle(fontSize: 11, color: _muted)),
                ])),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
  final Color iconColor;
  final Widget child;
  final Widget? trailing;

  const _SectionCard({
    required this.title, required this.subtitle,
    required this.icon,  required this.iconColor,
    required this.child, this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: iconColor.withValues(alpha: 0.1),
            ),
            child: Icon(icon, size: 14, color: iconColor),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 13,
                fontWeight: FontWeight.w700, color: _text)),
            Text(subtitle,
                style: TextStyle(fontSize: 10, color: _muted)),
          ])),
          if (trailing != null) trailing!,
        ]),
        const SizedBox(height: 14),
        child,
      ]),
    );
  }
}

class _MetricBar extends StatelessWidget {
  final String label, level;
  final double value; // 0.0 – 1.0
  final Color col;
  const _MetricBar({required this.label, required this.value,
    required this.level, required this.col});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(label,
              style: TextStyle(fontSize: 12, color: _text,
                  fontWeight: FontWeight.w500))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: col.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(5),
            ),
            child: Text(level,
                style: TextStyle(fontSize: 10, color: col,
                    fontWeight: FontWeight.w700)),
          ),
        ]),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 6,
            backgroundColor: col.withValues(alpha: 0.08),
            valueColor: AlwaysStoppedAnimation(col),
          ),
        ),
      ]),
    );
  }
}

class _FactorChip extends StatelessWidget {
  final String label;
  final Color col;
  const _FactorChip({required this.label, required this.col});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: col.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: col.withValues(alpha: 0.25)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 5, height: 5,
            decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(fontSize: 11, color: col,
                fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trend Painter — larger, more polished
// ─────────────────────────────────────────────────────────────────────────────

class _TrendPainter extends CustomPainter {
  final List<double> pts;
  const _TrendPainter({required this.pts});

  @override
  void paint(Canvas canvas, Size size) {
    if (pts.isEmpty) return;
    final W = size.width;
    final H = size.height;
    const pad = 8.0;

    // grid
    final gridP = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;
    for (int i = 1; i <= 4; i++) {
      final y = H * i / 4;
      canvas.drawLine(Offset(0, y), Offset(W, y), gridP);
    }

    // y-axis labels
    final yLabels = ['100', '75', '50', '25', '0'];
    for (int i = 0; i <= 4; i++) {
      final y = H * i / 4;
      final tp = TextPainter(
        text: TextSpan(text: yLabels[i],
            style: const TextStyle(fontSize: 8, color: Color(0xFFADB5BD))),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(0, y - tp.height / 2 - (i == 4 ? 2 : 0)));
    }

    // build path
    final path = Path();
    for (int i = 0; i < pts.length; i++) {
      final x = pad + (W - pad * 2) * i / (pts.length - 1);
      final y = H * (1 - pts[i].clamp(0.0, 1.0));
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }

    // fill gradient
    final fill = Path.from(path)
      ..lineTo(pad + (W - pad * 2), H)
      ..lineTo(pad, H)
      ..close();
    canvas.drawPath(fill, Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [AppColors.high.withValues(alpha: 0.20), Colors.transparent],
      ).createShader(Rect.fromLTWH(0, 0, W, H))
      ..style = PaintingStyle.fill);

    // stroke
    canvas.drawPath(path, Paint()
      ..color = AppColors.high
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke);

    // data points (only every few)
    final step = math.max(1, pts.length ~/ 8);
    for (int i = 0; i < pts.length; i += step) {
      final x = pad + (W - pad * 2) * i / (pts.length - 1);
      final y = H * (1 - pts[i].clamp(0.0, 1.0));
      canvas.drawCircle(Offset(x, y), 3.5, Paint()..color = AppColors.high);
      canvas.drawCircle(Offset(x, y), 3.5,
          Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 1.5);
    }

    // last point enlarged + score label
    final lastX = pad + (W - pad * 2);
    final lastY = H * (1 - pts.last.clamp(0.0, 1.0));
    canvas.drawCircle(Offset(lastX, lastY), 6, Paint()..color = AppColors.high);
    canvas.drawCircle(Offset(lastX, lastY), 6,
        Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);

    final scoreTp = TextPainter(
      text: TextSpan(
        text: (pts.last * 100).toStringAsFixed(0),
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
            color: AppColors.high),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    scoreTp.paint(canvas,
        Offset(lastX - scoreTp.width / 2, lastY - scoreTp.height - 8));
  }

  @override
  bool shouldRepaint(_TrendPainter old) => old.pts != pts;
}
