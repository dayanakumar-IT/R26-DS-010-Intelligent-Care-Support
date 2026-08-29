import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

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
    final roomId = a['room_id'] ?? '—';
    final time   = (a['created_at'] ?? '').toString();
    final timeStr = time.length >= 16 ? time.substring(0, 16).replaceAll('T', ' ') : '—';

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(children: [
          // ── Header ────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Row(children: [
                  const Icon(Icons.arrow_back_ios_rounded, size: 16, color: AppColors.primary),
                  Text('Replay – Room $roomId',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
                ]),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('5 sec', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
            ]),
          ),

          // ── Time ──────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              Text('Time: $timeStr', style: TextStyle(fontSize: 12, color: AppColors.mutedLight)),
            ]),
          ),
          const SizedBox(height: 12),

          // ── Skeleton canvas ───────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: double.infinity, height: 220,
              decoration: BoxDecoration(
                color: const Color(0xFF0D1B2E),
                borderRadius: BorderRadius.circular(12),
              ),
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => CustomPaint(
                  painter: _AnimatedSkeletonPainter(_ctrl.value),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Progress bar ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => LinearProgressIndicator(
                  value: _ctrl.value,
                  backgroundColor: AppColors.borderLight,
                  color: AppColors.primary,
                  minHeight: 4,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 6),
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('0:0${(_ctrl.value * 5).floor()}',
                        style: TextStyle(fontSize: 10, color: AppColors.mutedLight)),
                    Text('0:05', style: TextStyle(fontSize: 10, color: AppColors.mutedLight)),
                  ],
                ),
              ),
            ]),
          ),
          const SizedBox(height: 12),

          // ── Controls ──────────────────────────────────────────────────
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton(
              icon: const Icon(Icons.skip_previous_rounded, size: 28),
              color: AppColors.primary,
              onPressed: () => _ctrl.reset(),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _toggle,
              child: Container(
                width: 48, height: 48,
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.white, size: 28),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.skip_next_rounded, size: 28),
              color: AppColors.primary,
              onPressed: () => _ctrl.animateTo(1.0),
            ),
          ]),
          const SizedBox(height: 16),

          // ── Observation ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                border: Border.all(color: AppColors.borderLight),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Observation',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                const SizedBox(height: 6),
                Text('Right side body tilt and increased sway before high risk detected.',
                    style: TextStyle(fontSize: 12, color: AppColors.mutedLight, height: 1.5)),
                const SizedBox(height: 10),
                Wrap(spacing: 6, children: [
                  _Tag('High sway', AppColors.high),
                  _Tag('Body tilt', AppColors.moderate),
                ]),
              ]),
            ),
          ),
        ]),
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
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _AnimatedSkeletonPainter extends CustomPainter {
  final double t; // 0.0 → 1.0
  const _AnimatedSkeletonPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;

    // Sway offset — body tilts right then recovers
    final sway = t < 0.5 ? t * 30 : (1 - t) * 30;

    final paint = Paint()..strokeWidth = 2.5..style = PaintingStyle.stroke;

    // Head
    paint.color = const Color(0xFFFFD700);
    canvas.drawCircle(Offset(cx + sway * 0.3, cy - 65), 14, paint);

    // Body
    paint.color = Colors.white;
    canvas.drawLine(Offset(cx + sway * 0.3, cy - 51), Offset(cx + sway, cy - 10), paint);

    // Arms
    paint.color = const Color(0xFF60A5FA);
    canvas.drawLine(Offset(cx - 30 + sway * 0.2, cy - 35), Offset(cx + 30 + sway * 0.5, cy - 35), paint);

    // Legs
    paint.color = const Color(0xFFEF4444);
    canvas.drawLine(Offset(cx + sway, cy - 10), Offset(cx - 20 + sway, cy + 40), paint);
    canvas.drawLine(Offset(cx + sway, cy - 10), Offset(cx + 20 + sway, cy + 40), paint);

    // Risk score text
    final tp = TextPainter(
      text: TextSpan(
        text: 'Score: ${(0.3 + t * 0.5).toStringAsFixed(2)}',
        style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12, fontWeight: FontWeight.w700),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(12, 12));
  }

  @override
  bool shouldRepaint(_AnimatedSkeletonPainter old) => old.t != t;
}
