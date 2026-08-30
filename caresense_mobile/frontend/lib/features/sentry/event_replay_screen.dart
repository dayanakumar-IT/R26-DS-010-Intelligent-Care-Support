import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';

// ── Bone pairs — 14-joint MediaPipe subset ───────────────────────────────────
const List<List<int>> _kBones = [
  [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [1, 8], [1, 9], [8, 10], [9, 11], [10, 12], [11, 13],
];

// ── Hero gradient (matches patient_detail_screen) ────────────────────────────
const _heroStart = Color(0xFF1A56DB);
const _heroEnd   = Color(0xFF5B21B6);

Color _riskColor(String lvl) {
  switch (lvl.toUpperCase()) {
    case 'HIGH':     return AppColors.high;
    case 'MODERATE': return AppColors.moderate;
    case 'LOW':      return AppColors.low;
    default:         return AppColors.low;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class EventReplayScreen extends StatefulWidget {
  final Map<String, dynamic> alert;
  const EventReplayScreen({super.key, required this.alert});
  @override
  State<EventReplayScreen> createState() => _EventReplayScreenState();
}

class _EventReplayScreenState extends State<EventReplayScreen>
    with SingleTickerProviderStateMixin {
  List<Map<String, dynamic>> _frames = [];
  bool _loading = true;
  bool _playing = true;
  int  _idx     = 0;
  Timer? _timer;

  late final AnimationController _heroCtrl;
  late final Animation<double>    _heroFade;

  @override
  void initState() {
    super.initState();
    _heroCtrl = AnimationController(vsync: this,
        duration: const Duration(milliseconds: 500));
    _heroFade = CurvedAnimation(parent: _heroCtrl, curve: Curves.easeOut);
    _heroCtrl.forward();
    _loadFrames();
  }

  Future<void> _loadFrames() async {
    final id = widget.alert['id'];
    if (id == null) { setState(() => _loading = false); return; }
    final frames = await SentryService.getReplay(
        id is int ? id : int.tryParse(id.toString()) ?? 0);
    if (mounted) {
      setState(() { _frames = frames; _loading = false; });
      if (frames.isNotEmpty) _startTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 80), (_) {
      if (!mounted || !_playing || _frames.isEmpty) return;
      setState(() => _idx = (_idx + 1) % _frames.length);
    });
  }

  void _toggle() {
    setState(() => _playing = !_playing);
    if (_playing) _startTimer(); else _timer?.cancel();
  }

  void _restart() {
    setState(() { _idx = 0; _playing = true; });
    _startTimer();
  }

  void _skipEnd() {
    _timer?.cancel();
    setState(() {
      _idx     = _frames.isEmpty ? 0 : _frames.length - 1;
      _playing = false;
    });
  }

  @override
  void dispose() { _timer?.cancel(); _heroCtrl.dispose(); super.dispose(); }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final a        = widget.alert;
    final level    = (a['risk_level'] ?? 'HIGH').toString();
    final roomId   = a['room_id']?.toString() ?? '--';
    final rawTime  = (a['created_at'] ?? '').toString();
    final timeStr  = rawTime.length >= 16
        ? rawTime.substring(0, 16).replaceAll('T', '  ')
        : '--';
    final color    = _riskColor(level);
    final factors  = (a['key_factors'] as List?)?.cast<String>()
        ?? <String>['Body tilt', 'High sway'];

    final frame      = (_frames.isNotEmpty && _idx < _frames.length)
        ? _frames[_idx] : null;
    final rawScore   = frame?['risk_score'];
    final scoreVal   = rawScore != null ? (rawScore as num).toDouble() : null;
    final scoreDisp  = scoreVal != null
        ? (scoreVal > 1 ? '${scoreVal.round()}' : '${(scoreVal * 100).round()}')
        : '--';
    final progress   = _frames.isEmpty
        ? 0.0
        : _idx / (_frames.length - 1).clamp(1, 9999);
    final clipSecs   = _frames.isEmpty
        ? '--'
        : '${(_frames.length * 0.08).toStringAsFixed(1)}s';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
                // deco circles
                Positioned(top: -16, right: -16,
                  child: Container(width: 110, height: 110,
                    decoration: BoxDecoration(shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.05)))),
                Positioned(bottom: -8, left: -24,
                  child: Container(width: 80, height: 80,
                    decoration: BoxDecoration(shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.04)))),

                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start, children: [

                    // back + title row
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
                      Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        const Text('Event Replay',
                            style: TextStyle(fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Colors.white)),
                        Text('Room $roomId',
                            style: TextStyle(fontSize: 11,
                                color: Colors.white.withValues(alpha: 0.7))),
                      ])),
                      // risk badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: color.withValues(alpha: 0.6), width: 1.2),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(width: 6, height: 6,
                              decoration: BoxDecoration(
                                  color: color, shape: BoxShape.circle)),
                          const SizedBox(width: 5),
                          Text(level == 'MODERATE' ? 'MOD' : level,
                              style: TextStyle(color: color, fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5)),
                        ]),
                      ),
                    ]),

                    const SizedBox(height: 14),

                    // meta row
                    Row(children: [
                      _HeroChip(
                        icon: Icons.schedule_rounded,
                        label: timeStr,
                      ),
                      const SizedBox(width: 8),
                      _HeroChip(
                        icon: Icons.movie_filter_rounded,
                        label: '${_frames.length} frames',
                      ),
                      const SizedBox(width: 8),
                      _HeroChip(
                        icon: Icons.timer_outlined,
                        label: clipSecs == '--' ? '--' : '$clipSecs clip',
                      ),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),

        // ── Scrollable body ────────────────────────────────────────────────
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

              // ── Skeleton canvas ──────────────────────────────────────────
              Container(
                width: double.infinity,
                height: 260,
                decoration: BoxDecoration(
                  color: const Color(0xFF060D1A),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 20, offset: const Offset(0, 6)),
                    BoxShadow(color: color.withValues(alpha: 0.12),
                        blurRadius: 24, offset: const Offset(0, 8)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(children: [
                    // painter
                    _loading
                      ? const Center(child: CircularProgressIndicator(
                          color: Colors.white38, strokeWidth: 2))
                      : frame == null
                          ? Center(child: Column(
                              mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.videocam_off_rounded,
                                  size: 36,
                                  color: Colors.white.withValues(alpha: 0.2)),
                              const SizedBox(height: 8),
                              Text('No replay data',
                                  style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.4),
                                      fontSize: 13)),
                            ]))
                          : CustomPaint(
                              painter: _SkeletonPainter(
                                skeleton: _parseJoints(frame['skeleton']),
                                riskColor: color,
                                scoreDisplay: scoreDisp,
                                isPlaying: _playing,
                              ),
                              child: const SizedBox.expand(),
                            ),

                    // frame counter chip (bottom-right)
                    if (!_loading) Positioned(
                      bottom: 10, right: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${_idx + 1} / ${_frames.isEmpty ? 0 : _frames.length}',
                          style: const TextStyle(fontSize: 10,
                              color: Colors.white70, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 10),

              // ── Progress bar ─────────────────────────────────────────────
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: const Color(0xFFE2E8F0),
                  valueColor: AlwaysStoppedAnimation(color),
                  minHeight: 5,
                ),
              ),
              const SizedBox(height: 18),

              // ── Transport controls ───────────────────────────────────────
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                _CtrlBtn(
                  icon: Icons.replay_rounded,
                  onTap: _restart,
                  tooltip: 'Restart',
                ),
                const SizedBox(width: 16),
                // play / pause — big
                GestureDetector(
                  onTap: _toggle,
                  child: Container(
                    width: 60, height: 60,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [color, color.withValues(alpha: 0.75)],
                        begin: Alignment.topLeft, end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(
                          color: color.withValues(alpha: 0.40),
                          blurRadius: 16, offset: const Offset(0, 5))],
                    ),
                    child: Icon(
                      _playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: Colors.white, size: 30),
                  ),
                ),
                const SizedBox(width: 16),
                _CtrlBtn(
                  icon: Icons.skip_next_rounded,
                  onTap: _skipEnd,
                  tooltip: 'Skip to end',
                ),
              ]),
              const SizedBox(height: 20),

              // ── Alert Details card ───────────────────────────────────────
              _InfoCard(
                icon: Icons.info_outline_rounded,
                iconColor: AppColors.accentBlue,
                title: 'Alert Details',
                child: Column(children: [
                  _DetailRow('Room',       'Room $roomId'),
                  _DetailRow('Risk Level', level, valueColor: color),
                  _DetailRow('Recorded',   timeStr),
                  _DetailRow('Patient ID',
                      a['patient_id']?.toString() ?? '--'),
                ]),
              ),
              const SizedBox(height: 12),

              // ── Observations card ────────────────────────────────────────
              if (factors.isNotEmpty) _InfoCard(
                icon: Icons.remove_red_eye_outlined,
                iconColor: AppColors.moderate,
                title: 'Observations',
                child: Wrap(spacing: 8, runSpacing: 8,
                    children: factors.map((f) => _FactorChip(label: f, col: color)).toList()),
              ),
              const SizedBox(height: 12),

              // ── Score gauge card ─────────────────────────────────────────
              if (scoreDisp != '--') _InfoCard(
                icon: Icons.speed_rounded,
                iconColor: color,
                title: 'Risk Score',
                child: Row(children: [
                  Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(scoreDisp,
                        style: TextStyle(fontSize: 28,
                            fontWeight: FontWeight.w900, color: color)),
                    Text('out of 100',
                        style: TextStyle(fontSize: 11,
                            color: AppColors.mutedLight)),
                  ])),
                  _ScoreArc(value: double.tryParse(scoreDisp) ?? 0, color: color),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  List<Offset?> _parseJoints(dynamic raw) {
    if (raw == null) return [];
    final list = raw as List;
    return list.map((j) {
      if (j == null) return null;
      final arr = j as List;
      if (arr.length < 2) return null;
      return Offset((arr[0] as num).toDouble(), (arr[1] as num).toDouble());
    }).toList();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero chip
// ─────────────────────────────────────────────────────────────────────────────

class _HeroChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _HeroChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 11, color: Colors.white.withValues(alpha: 0.75)),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(fontSize: 10,
          color: Colors.white.withValues(alpha: 0.9),
          fontWeight: FontWeight.w600)),
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport button
// ─────────────────────────────────────────────────────────────────────────────

class _CtrlBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  const _CtrlBtn({required this.icon, required this.onTap, required this.tooltip});

  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46, height: 46,
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Icon(icon, size: 22, color: const Color(0xFF475569)),
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Info card
// ─────────────────────────────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final Widget child;
  const _InfoCard({required this.title, required this.icon,
    required this.iconColor, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE2E8F0)),
      borderRadius: BorderRadius.circular(14),
      boxShadow: [BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 10, offset: const Offset(0, 2))],
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
        Text(title,
            style: const TextStyle(fontSize: 13,
                fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
      ]),
      const SizedBox(height: 14),
      child,
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail row
// ─────────────────────────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  final String label, value;
  final Color? valueColor;
  const _DetailRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(children: [
      Text(label,
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
      const Spacer(),
      Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
          color: valueColor ?? const Color(0xFF0F172A))),
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor chip
// ─────────────────────────────────────────────────────────────────────────────

class _FactorChip extends StatelessWidget {
  final String label;
  final Color col;
  const _FactorChip({required this.label, required this.col});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: col.withValues(alpha: 0.08),
      border: Border.all(color: col.withValues(alpha: 0.3)),
      borderRadius: BorderRadius.circular(20),
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
// Score arc (mini semi-circle gauge)
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

    // track
    canvas.drawArc(rect, 2.36, 4.71, false,
        Paint()
          ..color = color.withValues(alpha: 0.12)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 8
          ..strokeCap = StrokeCap.round);

    // filled
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
// Skeleton painter
// ─────────────────────────────────────────────────────────────────────────────

class _SkeletonPainter extends CustomPainter {
  final List<Offset?> skeleton;
  final Color riskColor;
  final String scoreDisplay;
  final bool isPlaying;
  const _SkeletonPainter({
    required this.skeleton,
    required this.riskColor,
    required this.scoreDisplay,
    required this.isPlaying,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width;
    final H = size.height;

    // subtle grid
    final grid = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1;
    for (int i = 1; i < 4; i++) {
      canvas.drawLine(Offset(0, H * i / 4), Offset(W, H * i / 4), grid);
    }
    for (int i = 1; i < 5; i++) {
      canvas.drawLine(Offset(W * i / 5, 0), Offset(W * i / 5, H), grid);
    }

    if (skeleton.isEmpty) {
      final tp = TextPainter(
        text: const TextSpan(text: 'Waiting for skeleton data...',
            style: TextStyle(color: Colors.white38, fontSize: 12)),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: W);
      tp.paint(canvas, Offset((W - tp.width) / 2, (H - tp.height) / 2));
      return;
    }

    Offset? toCanvas(int idx) {
      if (idx >= skeleton.length) return null;
      final j = skeleton[idx];
      if (j == null) return null;
      return Offset(j.dx * W, j.dy * H);
    }

    // bones — glow + main
    for (final bone in _kBones) {
      final a = toCanvas(bone[0]);
      final b = toCanvas(bone[1]);
      if (a == null || b == null) continue;
      // glow
      canvas.drawLine(a, b, Paint()
        ..color = riskColor.withValues(alpha: 0.18)
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
      // main
      canvas.drawLine(a, b, Paint()
        ..color = Colors.white.withValues(alpha: 0.55)
        ..strokeWidth = 2.0
        ..strokeCap = StrokeCap.round);
    }

    // joints
    for (int i = 0; i < skeleton.length; i++) {
      final pos = toCanvas(i);
      if (pos == null) continue;
      final r = i == 0 ? 7.0 : 4.5;
      // glow ring
      canvas.drawCircle(pos, r + 3, Paint()
        ..color = riskColor.withValues(alpha: 0.2)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
      canvas.drawCircle(pos, r,
          Paint()..color = riskColor..style = PaintingStyle.fill);
      canvas.drawCircle(pos, r, Paint()
        ..color = Colors.white.withValues(alpha: 0.9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5);
    }

    // score label (top-left)
    final tp = TextPainter(
      text: TextSpan(text: 'Score: $scoreDisplay / 100',
          style: TextStyle(color: riskColor, fontSize: 11,
              fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, const Offset(12, 10));

    // PLAYING / PAUSED badge
    final badge      = isPlaying ? 'PLAYING' : 'PAUSED';
    final badgeColor = isPlaying
        ? const Color(0xFF22C55E) : const Color(0xFF94A3B8);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          Rect.fromLTWH(10, 28, badge.length * 6.2 + 12, 16),
          const Radius.circular(4)),
      Paint()..color = badgeColor.withValues(alpha: 0.22),
    );
    final badgeTp = TextPainter(
      text: TextSpan(text: badge,
          style: TextStyle(color: badgeColor, fontSize: 9,
              fontWeight: FontWeight.w800, letterSpacing: 0.6)),
      textDirection: TextDirection.ltr,
    )..layout();
    badgeTp.paint(canvas, const Offset(16, 31));
  }

  @override
  bool shouldRepaint(_SkeletonPainter old) =>
      old.skeleton != skeleton ||
      old.scoreDisplay != scoreDisplay ||
      old.isPlaying != isPlaying;
}
