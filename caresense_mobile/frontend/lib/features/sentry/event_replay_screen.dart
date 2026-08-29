import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

const _bg      = AppColors.bgDark;
const _surface = AppColors.surfaceDark;
const _border  = AppColors.borderDark;
const _text    = AppColors.textDark;
const _muted   = AppColors.mutedDark;
const _dim     = AppColors.dimDark;

class EventReplayScreen extends StatefulWidget {
  final Map<String, dynamic> alert;
  const EventReplayScreen({super.key, required this.alert});
  @override
  State<EventReplayScreen> createState() => _EventReplayScreenState();
}

class _EventReplayScreenState extends State<EventReplayScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  bool _playing = true;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 5))
      ..repeat();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  void _toggle() {
    setState(() {
      _playing = !_playing;
      _playing ? _ctrl.repeat() : _ctrl.stop();
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.alert;
    final level   = (a['risk_level'] ?? 'HIGH').toString();
    final roomId  = a['room_id'] ?? '—';
    final time    = (a['created_at'] ?? '').toString();
    final timeStr = time.length >= 16 ? time.substring(0, 16).replaceAll('T', ' ') : '—';
    final color   = level == 'HIGH' ? AppColors.high
                  : level == 'MODERATE' ? AppColors.moderate
                  : AppColors.low;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [
          // ── Header ──────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Row(children: [
                  const Icon(Icons.arrow_back_ios_rounded, size: 16, color: AppColors.accentBlue),
                  const SizedBox(width: 2),
                  Text('Replay – Room $roomId',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700,
                          color: AppColors.accentBlue)),
                ]),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentBlue.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.accentBlue.withValues(alpha: 0.35)),
                ),
                child: const Text('5 sec',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                        color: AppColors.accentBlue)),
              ),
            ]),
          ),

          // ── Timestamp ────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              const Icon(Icons.access_time_rounded, size: 13, color: AppColors.mutedDark),
              const SizedBox(width: 4),
              Text('Time: $timeStr', style: TextStyle(fontSize: 12, color: _muted)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(5)),
                child: Text(level == 'MODERATE' ? 'MOD' : level,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
              ),
            ]),
          ),
          const SizedBox(height: 10),

          // ── Skeleton canvas ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: double.infinity, height: 200,
              decoration: BoxDecoration(
                color: const Color(0xFF060D1A),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _border),
              ),
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => CustomPaint(
                  painter: _AnimatedSkeletonPainter(_ctrl.value, color),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Progress bar ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _ctrl.value,
                    backgroundColor: _border,
                    color: color,
                    minHeight: 5,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('0:0${(_ctrl.value * 5).floor()}',
                        style: TextStyle(fontSize: 10, color: _muted)),
                    Text('0:05', style: TextStyle(fontSize: 10, color: _muted)),
                  ],
                ),
              ),
            ]),
          ),
          const SizedBox(height: 14),

          // ── Controls ─────────────────────────────────────────────────────
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _ControlBtn(icon: Icons.skip_previous_rounded, onTap: () => _ctrl.reset()),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: _toggle,
              child: Container(
                width: 52, height: 52,
                decoration: BoxDecoration(
                    color: color, shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 12)]),
                child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.white, size: 28),
              ),
            ),
            const SizedBox(width: 12),
            _ControlBtn(icon: Icons.skip_next_rounded, onTap: () => _ctrl.animateTo(1.0)),
          ]),
          const SizedBox(height: 16),

          // ── Observation panel ────────────────────────────────────────────
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _surface,
                  border: Border.all(color: _border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.remove_red_eye_outlined, size: 14, color: AppColors.mutedDark),
                    const SizedBox(width: 5),
                    const Text('Observation',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _text)),
                  ]),
                  const SizedBox(height: 8),
                  Text('Right side body tilt and increased sway detected before HIGH risk event. Patient appears to be shifting weight towards bed edge.',
                      style: TextStyle(fontSize: 12, color: _muted, height: 1.6)),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 5, children: [
                    _Tag('High sway', AppColors.high),
                    _Tag('Body tilt', AppColors.moderate),
                    _Tag('Bed edge', AppColors.accentBlue),
                  ]),
                ]),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }
}

class _ControlBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _ControlBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          border: Border.all(color: AppColors.borderDark),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 20, color: AppColors.mutedDark),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;
  const _Tag(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

// ── Animated skeleton ────────────────────────────────────────────────────────
class _AnimatedSkeletonPainter extends CustomPainter {
  final double t;
  final Color riskColor;
  const _AnimatedSkeletonPainter(this.t, this.riskColor);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;

    // Body sway: tilts right then recovers
    final sway = t < 0.5 ? t * 28 : (1 - t) * 28;

    final p = Paint()..strokeWidth = 3..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

    // Head
    p.color = const Color(0xFFFFD700);
    p.style = PaintingStyle.stroke;
    canvas.drawCircle(Offset(cx + sway * 0.3, cy - 62), 13, p);

    // Body
    p.color = Colors.white;
    canvas.drawLine(
        Offset(cx + sway * 0.3, cy - 49), Offset(cx + sway, cy - 10), p);

    // Arms
    p.color = const Color(0xFF60A5FA);
    canvas.drawLine(
        Offset(cx - 28 + sway * 0.1, cy - 34),
        Offset(cx + 28 + sway * 0.5, cy - 34), p);

    // Legs
    p.color = riskColor;
    canvas.drawLine(
        Offset(cx + sway, cy - 10), Offset(cx - 18 + sway * 0.8, cy + 42), p);
    canvas.drawLine(
        Offset(cx + sway, cy - 10), Offset(cx + 18 + sway * 1.2, cy + 42), p);

    // Score overlay
    final score = (0.3 + t * 0.55).clamp(0.0, 1.0);
    final tp = TextPainter(
      text: TextSpan(
        text: 'Score: ${(score * 100).toStringAsFixed(0)}/100',
        style: TextStyle(color: riskColor, fontSize: 12, fontWeight: FontWeight.w700),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, const Offset(10, 10));
  }

  @override
  bool shouldRepaint(_AnimatedSkeletonPainter old) => old.t != t;
}
