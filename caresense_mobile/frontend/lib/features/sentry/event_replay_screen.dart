import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';

// Bone pairs — 14-joint MediaPipe subset (matches backend + live_room_screen)
const List<List<int>> _kBones = [
  [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [1, 8], [1, 9], [8, 10], [9, 11], [10, 12], [11, 13],
];

class EventReplayScreen extends StatefulWidget {
  final Map<String, dynamic> alert;
  const EventReplayScreen({super.key, required this.alert});
  @override
  State<EventReplayScreen> createState() => _EventReplayScreenState();
}

class _EventReplayScreenState extends State<EventReplayScreen> {
  List<Map<String, dynamic>> _frames = [];
  bool _loading = true;
  bool _playing = true;
  int _idx = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _loadFrames();
  }

  Future<void> _loadFrames() async {
    final id = widget.alert['id'];
    if (id == null) { setState(() => _loading = false); return; }
    final frames = await SentryService.getReplay(id is int ? id : int.tryParse(id.toString()) ?? 0);
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
    if (_playing) _startTimer();
    else _timer?.cancel();
  }

  void _restart() => setState(() { _idx = 0; _playing = true; _startTimer(); });
  void _skipEnd() => setState(() { _idx = _frames.isEmpty ? 0 : _frames.length - 1; _playing = false; _timer?.cancel(); });

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.alert;
    final level   = (a['risk_level'] ?? 'HIGH').toString();
    final roomId  = a['room_id']?.toString() ?? '--';
    final rawTime = (a['created_at'] ?? '').toString();
    final timeStr = rawTime.length >= 16
        ? rawTime.substring(0, 16).replaceAll('T', '  ')
        : '--';
    final color = level == 'HIGH'     ? AppColors.high
                : level == 'MODERATE' ? AppColors.moderate
                : AppColors.low;
    final levelLabel = level == 'MODERATE' ? 'MOD' : level;

    final frame = (_frames.isNotEmpty && _idx < _frames.length) ? _frames[_idx] : null;
    final rawScore = frame?['risk_score'];
    final scoreVal = rawScore != null ? (rawScore as num).toDouble() : null;
    final scoreDisplay = scoreVal != null
        ? (scoreVal > 1 ? '${scoreVal.round()}' : '${(scoreVal * 100).round()}')
        : '--';
    final progress = _frames.isEmpty ? 0.0 : _idx / (_frames.length - 1).clamp(1, 9999);

    // Key factors from alert
    final factors = (a['key_factors'] as List?)?.cast<String>() ?? <String>['Body tilt', 'High sway'];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 18, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Event Replay',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          Text('Room $roomId', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        ]),
        titleSpacing: 0,
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              border: Border.all(color: color.withOpacity(0.4)),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(levelLabel,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color)),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),

      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

          // Time badge
          Row(children: [
            const Icon(Icons.schedule_rounded, size: 13, color: Color(0xFF64748B)),
            const SizedBox(width: 4),
            Text(timeStr, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                border: Border.all(color: const Color(0xFFBFDBFE)),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('${_frames.length} frames',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                      color: Color(0xFF3B82F6))),
            ),
          ]),
          const SizedBox(height: 12),

          // Skeleton canvas
          Container(
            width: double.infinity,
            height: 240,
            decoration: BoxDecoration(
              color: const Color(0xFF060D1A),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Colors.white54, strokeWidth: 2))
                  : frame == null
                      ? const Center(child: Text('No replay data', style: TextStyle(color: Colors.white54, fontSize: 12)))
                      : CustomPaint(
                          painter: _SkeletonPainter(
                            skeleton: _parseJoints(frame['skeleton']),
                            riskColor: color,
                            scoreDisplay: scoreDisplay,
                            isPlaying: _playing,
                          ),
                          child: const SizedBox.expand(),
                        ),
            ),
          ),
          const SizedBox(height: 10),

          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: const Color(0xFFE2E8F0),
              color: color,
              minHeight: 5,
            ),
          ),
          const SizedBox(height: 4),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${_idx + 1}/${_frames.isEmpty ? 0 : _frames.length}',
                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            Text(_frames.isEmpty ? '--' : '${(_frames.length * 0.08).toStringAsFixed(1)}s clip',
                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
          ]),
          const SizedBox(height: 16),

          // Controls
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _RoundBtn(icon: Icons.replay_rounded, onTap: _restart,
                bg: const Color(0xFFF1F5F9), iconColor: const Color(0xFF475569)),
            const SizedBox(width: 14),
            GestureDetector(
              onTap: _toggle,
              child: Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  color: color, shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: color.withOpacity(0.35), blurRadius: 14, offset: const Offset(0, 4))],
                ),
                child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.white, size: 30),
              ),
            ),
            const SizedBox(width: 14),
            _RoundBtn(icon: Icons.skip_next_rounded, onTap: _skipEnd,
                bg: const Color(0xFFF1F5F9), iconColor: const Color(0xFF475569)),
          ]),
          const SizedBox(height: 20),

          // Alert details card
          _SectionCard(
            title: 'Alert Details',
            icon: Icons.info_outline_rounded,
            iconColor: AppColors.accentBlue,
            child: Column(children: [
              _DetailRow('Room', 'Room $roomId'),
              _DetailRow('Risk Level', level, valueColor: color),
              _DetailRow('Recorded', timeStr),
              _DetailRow('Patient ID', a['patient_id']?.toString() ?? '--'),
            ]),
          ),
          const SizedBox(height: 12),

          // Observation card
          if (factors.isNotEmpty) _SectionCard(
            title: 'Observation',
            icon: Icons.remove_red_eye_outlined,
            iconColor: AppColors.moderate,
            child: Wrap(spacing: 6, runSpacing: 6, children: factors.map((f) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.08),
                  border: Border.all(color: color.withOpacity(0.35)),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(f, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
              );
            }).toList()),
          ),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }

  List<Offset?> _parseJoints(dynamic raw) {
    if (raw == null) return [];
    final list = raw as List;
    return list.map((j) {
      if (j == null) return null;
      final arr = j as List;
      if (arr.length < 2) return null;
      final x = (arr[0] as num).toDouble();
      final y = (arr[1] as num).toDouble();
      return Offset(x, y);
    }).toList();
  }
}

// ── Skeleton painter — renders real keypoints like web dashboard ──────────────
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

    // Grid
    final grid = Paint()..color = Colors.white.withOpacity(0.04)..strokeWidth = 1;
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

    // Map normalized [0,1] coords to canvas
    Offset? toCanvas(int idx) {
      if (idx >= skeleton.length) return null;
      final j = skeleton[idx];
      if (j == null) return null;
      return Offset(j.dx * W, j.dy * H);
    }

    // Draw bones
    final bonePaint = Paint()
      ..color = Colors.white.withOpacity(0.55)
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    for (final bone in _kBones) {
      final a = toCanvas(bone[0]);
      final b = toCanvas(bone[1]);
      if (a != null && b != null) {
        canvas.drawLine(a, b, bonePaint);
      }
    }

    // Draw joints
    final dotFill = Paint()..color = riskColor..style = PaintingStyle.fill;
    final dotBorder = Paint()
      ..color = Colors.white.withOpacity(0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    for (int i = 0; i < skeleton.length; i++) {
      final pos = toCanvas(i);
      if (pos == null) continue;
      final r = i == 0 ? 7.0 : 5.0; // head bigger
      canvas.drawCircle(pos, r, dotFill);
      canvas.drawCircle(pos, r, dotBorder);
    }

    // Score overlay
    final tp = TextPainter(
      text: TextSpan(text: 'Score: $scoreDisplay / 100',
          style: TextStyle(color: riskColor, fontSize: 11, fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, const Offset(12, 10));

    // Status badge
    final badge = isPlaying ? 'PLAYING' : 'PAUSED';
    final badgeColor = isPlaying ? const Color(0xFF22C55E) : const Color(0xFF94A3B8);
    final liveBg = Paint()..color = badgeColor.withOpacity(0.2);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(8, 28, badge.length * 6.0 + 12, 16), const Radius.circular(4)),
      liveBg,
    );
    final liveText = TextPainter(
      text: TextSpan(text: badge,
          style: TextStyle(color: badgeColor, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
      textDirection: TextDirection.ltr,
    )..layout();
    liveText.paint(canvas, const Offset(14, 31));
  }

  @override
  bool shouldRepaint(_SkeletonPainter old) =>
      old.skeleton != skeleton || old.scoreDisplay != scoreDisplay || old.isPlaying != isPlaying;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
class _RoundBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final Color bg;
  final Color iconColor;
  const _RoundBtn({required this.icon, required this.onTap, required this.bg, required this.iconColor});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: 44, height: 44,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Icon(icon, size: 22, color: iconColor),
    ),
  );
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final Widget child;
  const _SectionCard({required this.title, required this.icon, required this.iconColor, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE2E8F0)),
      borderRadius: BorderRadius.circular(12),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 5),
        Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
      ]),
      const SizedBox(height: 10),
      child,
    ]),
  );
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _DetailRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(children: [
      Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
      const Spacer(),
      Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
          color: valueColor ?? const Color(0xFF0F172A))),
    ]),
  );
}
