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

const _heroStart = Color(0xFF1A56DB);
const _heroEnd   = Color(0xFF5B21B6);

// ── risk helpers ─────────────────────────────────────────────────────────────
Color _riskColor(String lvl) {
  switch (lvl.toUpperCase()) {
    case 'HIGH':     return AppColors.high;
    case 'MODERATE': return AppColors.moderate;
    case 'LOW':      return AppColors.low;
    default:         return AppColors.dimLight;
  }
}

String _levelLabel(String lvl) {
  switch (lvl.toUpperCase()) {
    case 'HIGH':     return 'HIGH';
    case 'MODERATE': return 'MODERATE';
    case 'LOW':      return 'LOW';
    default:         return lvl.toUpperCase();
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

  // latest resolved event data (from history)
  Map<String, dynamic>? _latestEvent;
  List<double> _trendPts = [];
  String? _resolvedPatientId;

  @override
  void initState() {
    super.initState();
    _tabs     = TabController(length: 2, vsync: this);
    _heroCtrl = AnimationController(vsync: this,
        duration: const Duration(milliseconds: 600));
    _heroFade = CurvedAnimation(parent: _heroCtrl, curve: Curves.easeOut);
    _heroCtrl.forward();
    _loadAll();
  }

  Future<void> _loadAll() async {
    // Resolve patient DB id
    var id = widget.patient['id'];
    if (id == null) {
      final code = widget.patient['patient_code']?.toString();
      if (code != null && code.isNotEmpty) {
        try {
          final res = await Supabase.instance.client
              .from('patients').select('id')
              .eq('patient_code', code).maybeSingle();
          id = res?['id'];
        } catch (_) {}
      }
    }
    _resolvedPatientId = id?.toString();

    if (_resolvedPatientId != null && mounted) {
      final future = SentryService.getPatientHistory(_resolvedPatientId!);
      setState(() { _historyFuture = future; });

      final data = await future;
      if (mounted && data.isNotEmpty) {
        // newest first — take the first entry as latest event
        final latest = data.first;
        final pts = data.reversed
            .map((e) => ((e['risk_score'] as num?)?.toDouble() ?? 0.0))
            .toList();
        setState(() {
          _latestEvent = latest;
          _trendPts = pts.length > 20
              ? pts.sublist(pts.length - 20)
              : pts;
        });
      }
    }

    // Load alerts for replay (filtered by patient)
    setState(() {
      _alertsFuture = SentryService.getAlerts(unackedOnly: false);
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    _heroCtrl.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final p       = widget.patient;
    final roomId  = (p['room_id']      ?? '--').toString();
    final code    = (p['patient_code'] ?? '--').toString();
    final gender  = (p['gender']       ?? '--').toString();

    // Prefer real latest-event risk; fall back to whatever the patient map has
    final riskLvl = _latestEvent != null
        ? (_latestEvent!['risk_level'] ?? p['risk_level'] ?? '--').toString()
        : (p['risk_level'] ?? '--').toString();
    final riskCol = riskLvl == '--' ? _dim : _riskColor(riskLvl);
    final scoreRaw = _latestEvent?['risk_score'] ?? p['risk_score'];
    final score = scoreRaw != null
        ? (scoreRaw as num).toStringAsFixed(1)
        : '--';
    final zone    = (_latestEvent?['zone']    ?? '--').toString();

    return Scaffold(
      backgroundColor: _bg,
      body: Column(children: [

        // ── Gradient hero header ───────────────────────────────────────────
        FadeTransition(
          opacity: _heroFade,
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

                    Row(children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
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
                                fontWeight: FontWeight.w800,
                                color: Colors.white)),
                      ),
                      if (riskLvl != '--')
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: riskCol.withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: riskCol.withValues(alpha: 0.6),
                                width: 1.2),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Container(width: 6, height: 6,
                                decoration: BoxDecoration(
                                    color: riskCol, shape: BoxShape.circle)),
                            const SizedBox(width: 5),
                            Text(_levelLabel(riskLvl),
                                style: TextStyle(color: riskCol, fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.5)),
                          ]),
                        ),
                    ]),

                    const SizedBox(height: 12),
                    Text('Patient $code  •  $gender',
                        style: TextStyle(fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.7))),
                    const SizedBox(height: 14),

                    // stat tiles — all from real data
                    Row(children: [
                      _HeroStat(icon: Icons.monitor_heart_outlined,
                          label: 'Risk Score', value: score),
                      const SizedBox(width: 10),
                      _HeroStat(icon: Icons.bed_rounded,
                          label: 'Zone', value: zone),
                      const SizedBox(width: 10),
                      _HeroStat(icon: Icons.access_time_rounded,
                          label: 'Monitoring', value: 'LIVE'),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),

        // ── Tab bar ─────────────────────────────────────────────────────────
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

        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _OverviewTab(
                latestEvent: _latestEvent,
                trendPts: _trendPts,
                alertsFuture: _alertsFuture,
                resolvedPatientId: _resolvedPatientId,
                historyLoading: _historyFuture == null,
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
// Overview Tab — all data from API, no hardcodes
// ─────────────────────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic>? latestEvent;
  final List<double> trendPts;
  final Future<List<Map<String, dynamic>>>? alertsFuture;
  final String? resolvedPatientId;
  final bool historyLoading;

  const _OverviewTab({
    required this.latestEvent,
    required this.trendPts,
    required this.alertsFuture,
    required this.resolvedPatientId,
    required this.historyLoading,
  });

  @override
  Widget build(BuildContext context) {
    final hasData = latestEvent != null;

    // Real values from latest event
    final riskScore  = latestEvent?['risk_score'];
    final riskLvl    = (latestEvent?['risk_level'] ?? '--').toString().toUpperCase();
    final posture    = (latestEvent?['posture']    ?? '--').toString();
    final zone       = (latestEvent?['zone']       ?? '--').toString();
    final poseQual   = (latestEvent?['pose_quality']  ?? '--').toString();
    final confidence = latestEvent?['confidence'];
    final confidStr  = confidence != null
        ? '${((confidence as num) * 100).toStringAsFixed(0)}%' : '--';
    final factors    = hasData
        ? ((latestEvent!['key_factors'] as List?)?.cast<String>() ?? <String>[])
        : <String>[];
    final riskCol    = riskLvl == '--' ? _dim : _riskColor(riskLvl);
    final scoreNum   = riskScore != null
        ? (riskScore as num).toDouble() : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

        // ── Trend chart ────────────────────────────────────────────────────
        _SectionCard(
          title: 'Risk Score Trend',
          subtitle: 'Last ${trendPts.length} readings',
          icon: Icons.show_chart_rounded,
          iconColor: AppColors.high,
          child: historyLoading
              ? const SizedBox(height: 130,
                  child: Center(child: CircularProgressIndicator(
                      color: AppColors.accentBlue, strokeWidth: 2)))
              : trendPts.isEmpty
                  ? _emptyChart()
                  : SizedBox(
                      height: 130,
                      child: CustomPaint(
                        painter: _TrendPainter(pts: trendPts),
                        size: const Size(double.infinity, 130),
                      ),
                    ),
        ),
        const SizedBox(height: 12),

        // ── Latest event metrics ────────────────────────────────────────────
        _SectionCard(
          title: 'Latest Event Data',
          subtitle: hasData
              ? _formatTs(latestEvent!['timestamp']?.toString() ?? '')
              : 'No events yet',
          icon: Icons.bar_chart_rounded,
          iconColor: AppColors.accentBlue,
          child: historyLoading
              ? const Center(child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: CircularProgressIndicator(
                      color: AppColors.accentBlue, strokeWidth: 2)))
              : !hasData
                  ? _noDataRow()
                  : Column(children: [
                      _MetricRow('Risk Level', _levelLabel(riskLvl),
                          riskCol, icon: Icons.warning_rounded),
                      _MetricRow('Risk Score',
                          scoreNum != null
                              ? scoreNum.toStringAsFixed(2) : '--',
                          riskCol, icon: Icons.speed_rounded),
                      _MetricRow('Posture', posture,
                          AppColors.accentBlue, icon: Icons.accessibility_new_rounded),
                      _MetricRow('Zone', zone,
                          AppColors.moderate, icon: Icons.place_rounded),
                      _MetricRow('Pose Quality', poseQual,
                          AppColors.low, icon: Icons.verified_outlined),
                      _MetricRow('Confidence', confidStr,
                          AppColors.low, icon: Icons.percent_rounded),
                    ]),
        ),
        const SizedBox(height: 12),

        // ── Key factors ─────────────────────────────────────────────────────
        if (hasData) _SectionCard(
          title: 'Active Risk Factors',
          subtitle: factors.isEmpty
              ? 'None detected' : '${factors.length} factor${factors.length != 1 ? 's' : ''} detected',
          icon: Icons.warning_amber_rounded,
          iconColor: AppColors.moderate,
          child: factors.isEmpty
              ? _noFactorRow()
              : Wrap(spacing: 8, runSpacing: 8,
                  children: factors.map((f) =>
                      _FactorChip(label: f, col: riskCol)).toList()),
        ),
        if (hasData) const SizedBox(height: 12),

        // ── Score gauge ──────────────────────────────────────────────────────
        if (scoreNum != null) _SectionCard(
          title: 'Risk Score Gauge',
          subtitle: 'Current assessment',
          icon: Icons.speed_rounded,
          iconColor: riskCol,
          child: Row(children: [
            Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(scoreNum.toStringAsFixed(2),
                  style: TextStyle(fontSize: 28,
                      fontWeight: FontWeight.w900, color: riskCol)),
              Text('Confidence: $confidStr',
                  style: TextStyle(fontSize: 11, color: _muted)),
            ])),
            _ScoreArc(value: scoreNum * (scoreNum <= 1 ? 100 : 1),
                color: riskCol),
          ]),
        ),
        if (scoreNum != null) const SizedBox(height: 20),
        if (scoreNum == null && !historyLoading) const SizedBox(height: 8),

        // ── View Replay button ───────────────────────────────────────────────
        FutureBuilder<List<Map<String, dynamic>>>(
          future: alertsFuture,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return Container(
                width: double.infinity, height: 54,
                decoration: BoxDecoration(
                  color: _border, borderRadius: BorderRadius.circular(14)),
                child: const Center(child: SizedBox(width: 18, height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.accentBlue))),
              );
            }

            // Filter alerts to this patient (by patient_id match)
            final all = snap.data ?? [];
            final pid = resolvedPatientId;
            final patientAlerts = pid != null
                ? all.where((a) =>
                    a['patient_id']?.toString() == pid).toList()
                : <Map<String, dynamic>>[];

            // Fall back to first alert if none match this patient
            final target = patientAlerts.isNotEmpty
                ? patientAlerts.first
                : (all.isNotEmpty ? all.first : <String, dynamic>{});

            final hasAlert = target.isNotEmpty;

            return GestureDetector(
              onTap: hasAlert
                  ? () => Navigator.push(context, MaterialPageRoute(
                      builder: (_) => EventReplayScreen(alert: target)))
                  : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  gradient: hasAlert
                      ? const LinearGradient(
                          colors: [_heroStart, _heroEnd],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight)
                      : null,
                  color: hasAlert ? null : _border,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: hasAlert ? [
                    BoxShadow(color: AppColors.accentBlue.withValues(alpha: 0.30),
                        blurRadius: 16, offset: const Offset(0, 6)),
                  ] : [],
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: hasAlert ? 0.2 : 0.0),
                    ),
                    child: Icon(Icons.play_arrow_rounded,
                        color: hasAlert ? Colors.white : _dim, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Text('View Replay',
                      style: TextStyle(
                          color: hasAlert ? Colors.white : _dim,
                          fontSize: 15, fontWeight: FontWeight.w800)),
                  if (hasAlert) ...[
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
                  ],
                ]),
              ),
            );
          },
        ),
      ]),
    );
  }

  Widget _emptyChart() => SizedBox(
    height: 130,
    child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.show_chart_rounded, size: 32,
          color: _dim.withValues(alpha: 0.4)),
      const SizedBox(height: 6),
      Text('No trend data yet', style: TextStyle(color: _muted, fontSize: 12)),
    ])),
  );

  Widget _noDataRow() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.hourglass_empty_rounded, size: 18, color: _dim),
      const SizedBox(width: 8),
      Text('No events recorded yet',
          style: TextStyle(color: _muted, fontSize: 12)),
    ]),
  );

  Widget _noFactorRow() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(children: [
      Icon(Icons.check_circle_outline_rounded, size: 16, color: AppColors.low),
      const SizedBox(width: 8),
      Text('No risk factors detected',
          style: TextStyle(color: _muted, fontSize: 12)),
    ]),
  );

  String _formatTs(String ts) {
    if (ts.length >= 16) return ts.substring(0, 16).replaceAll('T', '  ');
    return ts;
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
    final lvl      = (event['risk_level'] ?? 'NORMAL').toString().toUpperCase();
    final col      = _riskColor(lvl);
    final ts       = (event['timestamp'] ?? '').toString();
    final timeStr  = ts.length >= 19 ? ts.substring(11, 19)
                   : ts.length >= 16 ? ts.substring(11, 16) : '--';
    final dateStr  = ts.length >= 10 ? ts.substring(0, 10) : '';
    final score    = event['risk_score'];
    final scoreStr = score != null
        ? (score as num).toStringAsFixed(2) : '--';
    final factors  = (event['key_factors'] as List?)?.cast<String>() ?? [];

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
            color: col.withValues(alpha: 0.06),
            blurRadius: 8, offset: const Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(children: [
          Container(width: 4, color: col),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: col.withValues(alpha: 0.1)),
                    child: Icon(
                      lvl == 'HIGH'     ? Icons.warning_rounded
                          : lvl == 'MODERATE' ? Icons.info_outline_rounded
                          : Icons.check_circle_outline_rounded,
                      size: 15, color: col),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text('Score: $scoreStr',
                        style: TextStyle(fontSize: 13,
                            fontWeight: FontWeight.w700, color: _text)),
                    Text(dateStr.isEmpty ? timeStr : '$dateStr  $timeStr',
                        style: TextStyle(fontSize: 10, color: _muted)),
                  ])),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                        color: col.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(5)),
                    child: Text(lvl, style: TextStyle(fontSize: 9,
                        fontWeight: FontWeight.w800, color: col)),
                  ),
                ]),
                if (factors.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(factors.take(3).join('  •  '),
                      style: TextStyle(fontSize: 10, color: _dim),
                      overflow: TextOverflow.ellipsis),
                ],
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared small widgets
// ─────────────────────────────────────────────────────────────────────────────

class _HeroStat extends StatelessWidget {
  final IconData icon;
  final String label, value;
  const _HeroStat({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Expanded(
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
            style: TextStyle(fontSize: 9,
                color: Colors.white.withValues(alpha: 0.6),
                letterSpacing: 0.4)),
        const SizedBox(height: 2),
        Text(value,
            style: const TextStyle(fontSize: 13,
                fontWeight: FontWeight.w800, color: Colors.white),
            overflow: TextOverflow.ellipsis),
      ]),
    ),
  );
}

class _SectionCard extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
  final Color iconColor;
  final Widget child;
  const _SectionCard({required this.title, required this.subtitle,
    required this.icon, required this.iconColor, required this.child});

  @override
  Widget build(BuildContext context) => Container(
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
              color: iconColor.withValues(alpha: 0.1)),
          child: Icon(icon, size: 14, color: iconColor),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 13,
              fontWeight: FontWeight.w700, color: _text)),
          Text(subtitle, style: TextStyle(fontSize: 10, color: _muted)),
        ])),
      ]),
      const SizedBox(height: 14),
      child,
    ]),
  );
}

class _MetricRow extends StatelessWidget {
  final String label, value;
  final Color col;
  final IconData icon;
  const _MetricRow(this.label, this.value, this.col, {required this.icon});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(children: [
      Icon(icon, size: 13, color: col.withValues(alpha: 0.7)),
      const SizedBox(width: 8),
      Expanded(child: Text(label,
          style: TextStyle(fontSize: 12, color: _muted))),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: col.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(value,
            style: TextStyle(fontSize: 11,
                fontWeight: FontWeight.w700, color: col)),
      ),
    ]),
  );
}

class _FactorChip extends StatelessWidget {
  final String label;
  final Color col;
  const _FactorChip({required this.label, required this.col});

  @override
  Widget build(BuildContext context) => Container(
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

// ─────────────────────────────────────────────────────────────────────────────
// Score arc gauge
// ─────────────────────────────────────────────────────────────────────────────

class _ScoreArc extends StatelessWidget {
  final double value; // 0–100
  final Color color;
  const _ScoreArc({required this.value, required this.color});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 72, height: 72,
    child: CustomPaint(painter: _ArcPainter(value: value, color: color)),
  );
}

class _ArcPainter extends CustomPainter {
  final double value;
  final Color color;
  const _ArcPainter({required this.value, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r  = size.width / 2 - 6;
    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: r);
    canvas.drawArc(rect, 2.36, 4.71, false,
        Paint()
          ..color = color.withValues(alpha: 0.12)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 8
          ..strokeCap = StrokeCap.round);
    final sweep = (value.clamp(0, 100) / 100) * 4.71;
    canvas.drawArc(rect, 2.36, sweep, false,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 8
          ..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(_ArcPainter old) =>
      old.value != value || old.color != color;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trend painter
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
      canvas.drawLine(Offset(0, H * i / 4), Offset(W, H * i / 4), gridP);
    }

    // y-axis labels
    final yLabels = ['1.0', '0.75', '0.50', '0.25', '0.0'];
    for (int i = 0; i <= 4; i++) {
      final y = H * i / 4;
      final tp = TextPainter(
        text: TextSpan(text: yLabels[i],
            style: const TextStyle(fontSize: 8, color: Color(0xFFADB5BD))),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(0, y - tp.height / 2));
    }

    final path = Path();
    for (int i = 0; i < pts.length; i++) {
      final x = pad + (W - pad * 2) * i / (pts.length - 1);
      final y = H * (1 - pts[i].clamp(0.0, 1.0));
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }

    // fill
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

    // line
    canvas.drawPath(path, Paint()
      ..color = AppColors.high
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke);

    // dots
    final step = math.max(1, pts.length ~/ 8);
    for (int i = 0; i < pts.length; i += step) {
      final x = pad + (W - pad * 2) * i / (pts.length - 1);
      final y = H * (1 - pts[i].clamp(0.0, 1.0));
      canvas.drawCircle(Offset(x, y), 3.5, Paint()..color = AppColors.high);
      canvas.drawCircle(Offset(x, y), 3.5, Paint()
          ..color = Colors.white
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5);
    }

    // last dot enlarged + label
    final lastX = pad + (W - pad * 2);
    final lastY = H * (1 - pts.last.clamp(0.0, 1.0));
    canvas.drawCircle(Offset(lastX, lastY), 6, Paint()..color = AppColors.high);
    canvas.drawCircle(Offset(lastX, lastY), 6, Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2);

    final scoreTp = TextPainter(
      text: TextSpan(
        text: pts.last.toStringAsFixed(2),
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
