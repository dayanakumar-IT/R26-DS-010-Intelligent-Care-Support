import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

// Event Replay Screen -- light theme, matches web dashboard replay panel.

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
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() {
      _playing = !_playing;
      _playing ? _ctrl.repeat() : _ctrl.stop();
    });
  }

  void _restart() {
    _ctrl.reset();
    if (_playing) _ctrl.repeat();
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

    // Key factors from alert (static demo observations)
    final factors = <String>['Body tilt', 'High sway', 'Bed edge proximity'];

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
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A))),
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

          // -- Time badge ---------------------------------------------------
          Row(children: [
            const Icon(Icons.schedule_rounded, size: 13, color: Color(0xFF64748B)),
            const SizedBox(width: 4),
            Text(timeStr,
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                border: Border.all(color: const Color(0xFFBFDBFE)),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('5 sec clip',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                      color: Color(0xFF3B82F6))),
            ),
          ]),
          const SizedBox(height: 12),

          // -- Skeleton canvas ----------------------------------------------
          Container(
            width: double.infinity,
            height: 220,
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4)),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => CustomPaint(
                  painter: _ReplaySkeletonPainter(_ctrl.value, color),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // -- Progress bar + timestamp ------------------------------------
          AnimatedBuilder(
            animation: _ctrl,
            builder: (_, __) {
              final elapsed = (_ctrl.value * 5).floor();
              return Column(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _ctrl.value,
                    backgroundColor: const Color(0xFFE2E8F0),
                    color: color,
                    minHeight: 6,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('0:0$elapsed',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    const Text('0:05',
                        style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                  ],
                ),
              ]);
            },
          ),
          const SizedBox(height: 16),

          // -- Controls ----------------------------------------------------
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _RoundBtn(
              icon: Icons.replay_rounded,
              onTap: _restart,
              bg: const Color(0xFFF1F5F9),
              iconColor: const Color(0xFF475569),
            ),
            const SizedBox(width: 14),
            GestureDetector(
              onTap: _toggle,
              child: Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: color.withOpacity(0.35), blurRadius: 14, offset: const Offset(0, 4))],
                ),
                child: Icon(
                  _playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: Colors.white, size: 30,
                ),
              ),
            ),
            const SizedBox(width: 14),
            _RoundBtn(
              icon: Icons.skip_next_rounded,
              onTap: () => _ctrl.animateTo(1.0),
              bg: const Color(0xFFF1F5F9),
              iconColor: const Color(0xFF475569),
            ),
          ]),
          const SizedBox(height: 20),

          // -- Alert details card ------------------------------------------
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

          // -- Observation card --------------------------------------------
          _SectionCard(
            title: 'Observation',
            icon: Icons.remove_red_eye_outlined,
            iconColor: AppColors.moderate,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text(
                'Right side body tilt and increased sway detected before HIGH risk event. '
                'Patient appears to be shifting weight towards the bed edge.',
                style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.65),
              ),
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: factors.map((f) {
                final c = f == 'Body tilt' ? AppColors.moderate
                        : f == 'High sway' ? AppColors.high
                        : AppColors.accentBlue;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: c.withOpacity(0.08),
                    border: Border.all(color: c.withOpacity(0.35)),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(f, style: TextStyle(fontSize: 11, color: c, fontWeight: FontWeight.w600)),
                );
              }).toList()),
            ]),
          ),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }
}

// ============================================================
// Helpers
// ============================================================

class _RoundBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final Color bg;
  final Color iconColor;
  const _RoundBtn({required this.icon, required this.onTap,
      required this.bg, required this.iconColor});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Icon(icon, size: 22, color: iconColor),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final Widget child;
  const _SectionCard({required this.title, required this.icon,
      required this.iconColor, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A))),
        ]),
        const SizedBox(height: 10),
        child,
      ]),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _DetailRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        const Spacer(),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
            color: valueColor ?? const Color(0xFF0F172A))),
      ]),
    );
  }
}

// ============================================================
// Animated skeleton painter -- light canvas version
// ============================================================
class _ReplaySkeletonPainter extends CustomPainter {
  final double t;
  final Color riskColor;
  const _ReplaySkeletonPainter(this.t, this.riskColor);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;

    // Sway: tilt right, recover
    final sway = t < 0.5 ? t * 26 : (1 - t) * 26;

    final p = Paint()
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    // Grid lines (subtle)
    final grid = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..strokeWidth = 1;
    for (int i = 1; i < 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    for (int i = 1; i < 5; i++) {
      final x = size.width * i / 5;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }

    // Head
    p.color = const Color(0xFFFFD700);
    p.style = PaintingStyle.stroke;
    canvas.drawCircle(Offset(cx + sway * 0.3, cy - 58), 14, p);

    // Neck to torso
    p.color = Colors.white.withOpacity(0.9);
    canvas.drawLine(
      Offset(cx + sway * 0.3, cy - 44),
      Offset(cx + sway,       cy - 8),
      p,
    );

    // Arms
    p.color = const Color(0xFF60A5FA);
    canvas.drawLine(
      Offset(cx - 30 + sway * 0.1, cy - 30),
      Offset(cx + 30 + sway * 0.5, cy - 30),
      p,
    );

    // Left leg
    p.color = riskColor;
    canvas.drawLine(
      Offset(cx + sway,              cy - 8),
      Offset(cx - 20 + sway * 0.8,  cy + 48),
      p,
    );
    // Right leg
    canvas.drawLine(
      Offset(cx + sway,              cy - 8),
      Offset(cx + 20 + sway * 1.2,  cy + 48),
      p,
    );

    // Score overlay
    final score = ((0.3 + t * 0.55) * 100).round();
    final tp = TextPainter(
      text: TextSpan(
        text: 'Score: $score / 100',
        style: TextStyle(
          color: riskColor,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, const Offset(12, 10));

    // LIVE badge
    final liveBg = Paint()..color = const Color(0xFF22C55E).withOpacity(0.2);
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(8, 28, 46, 16), const Radius.circular(4)),
      liveBg,
    );
    final liveText = TextPainter(
      text: const TextSpan(
        text: 'REPLAY',
        style: TextStyle(color: Color(0xFF22C55E), fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    liveText.paint(canvas, const Offset(12, 31));
  }

  @override
  bool shouldRepaint(_ReplaySkeletonPainter old) => old.t != t;
}
