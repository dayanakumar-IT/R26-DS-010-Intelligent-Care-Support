import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../core/constants/colors.dart';
import '../../core/config/api_config.dart';
import 'patient_detail_screen.dart';

// Bone pairs — 14-joint MediaPipe subset (matches backend config/settings.py)
const List<List<int>> kBones = [
  [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [1, 8], [1, 9], [8, 10], [9, 11], [10, 12], [11, 13],
];

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;

class LiveRoomScreen extends StatefulWidget {
  final String roomId;
  final String patientCode;
  const LiveRoomScreen({super.key, required this.roomId, required this.patientCode});
  @override
  State<LiveRoomScreen> createState() => _LiveRoomScreenState();
}

class _LiveRoomScreenState extends State<LiveRoomScreen> {
  WebSocketChannel? _channel;
  Map<String, dynamic>? _frame;
  bool _connected = false;
  bool _disposed  = false;
  Timer? _reconnectTimer;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  void _connect() {
    try {
      final wsUrl = ApiConfig.baseUrl
          .replaceFirst('http://', 'ws://')
          .replaceFirst('https://', 'wss://');
      _channel = WebSocketChannel.connect(
          Uri.parse('$wsUrl/ws/live/${widget.roomId}'));
      setState(() => _connected = true);
      _channel!.stream.listen(
        (raw) {
          try {
            final data = jsonDecode(raw as String) as Map<String, dynamic>;
            if (mounted) setState(() => _frame = data);
          } catch (_) {}
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_disposed || !mounted) return;
    setState(() => _connected = false);
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) _connect();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    super.dispose();
  }

  Color _levelColor(String? level) {
    if (level == 'HIGH')     return AppColors.high;
    if (level == 'MODERATE') return AppColors.moderate;
    return AppColors.low;
  }

  @override
  Widget build(BuildContext context) {
    final level     = (_frame?['risk_level'] ?? 'NORMAL').toString();
    final score     = _frame?['risk_score'];
    final posture   = _frame?['posture'] ?? '--';
    final zone      = _frame?['zone']    ?? '--';
    final conf      = _frame?['confidence'];
    final color     = _levelColor(level);
    final scoreText = score != null ? '${(score as num).toStringAsFixed(0)}' : '--';
    final confText  = conf  != null ? '${((conf as num) * 100).toStringAsFixed(0)}%' : '--';

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [

          // ── App bar ──────────────────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: _surface,
              boxShadow: [BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8, offset: const Offset(0, 2))],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accentBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.arrow_back_ios_rounded,
                      size: 16, color: AppColors.accentBlue),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('${widget.roomId}  ·  ${widget.patientCode}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800,
                          color: _text)),
                  Row(children: [
                    Container(width: 6, height: 6,
                        decoration: BoxDecoration(
                          color: _connected ? AppColors.low : AppColors.high,
                          shape: BoxShape.circle)),
                    const SizedBox(width: 4),
                    Text(_connected ? 'LIVE' : 'Reconnecting...',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _connected ? AppColors.low : AppColors.high,
                        )),
                  ]),
                ]),
              ),
              // Risk badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: color.withValues(alpha: 0.4)),
                ),
                child: Text(
                  level == 'MODERATE' ? 'MOD RISK'
                      : level == 'HIGH' ? 'HIGH RISK' : 'NORMAL',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
                ),
              ),
            ]),
          ),

          // ── Body ─────────────────────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(children: [

                // Skeleton canvas (dark)
                Container(
                  width: double.infinity,
                  height: MediaQuery.of(context).size.height * 0.38,
                  decoration: BoxDecoration(
                    color: const Color(0xFF060D1A),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(
                      color: color.withValues(alpha: 0.2),
                      blurRadius: 16, offset: const Offset(0, 4))],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: CustomPaint(
                    painter: _SkeletonPainter(_frame, level),
                    child: const SizedBox.expand(),
                  ),
                ),
                const SizedBox(height: 16),

                // Metric cards row
                Row(children: [
                  _MetricCard(
                    icon: Icons.speed_rounded,
                    label: 'Risk Score',
                    value: score != null ? '$scoreText/100' : '--',
                    color: color,
                  ),
                  const SizedBox(width: 10),
                  _MetricCard(
                    icon: Icons.track_changes_rounded,
                    label: 'Confidence',
                    value: confText,
                    color: AppColors.accentBlue,
                  ),
                  const SizedBox(width: 10),
                  _MetricCard(
                    icon: Icons.analytics_rounded,
                    label: 'Level',
                    value: level == 'MODERATE' ? 'MOD' : level,
                    color: color,
                  ),
                ]),
                const SizedBox(height: 12),

                // Posture + Zone
                Row(children: [
                  _InfoCard(Icons.accessibility_new_rounded, 'Posture', posture,
                      AppColors.accentBlue),
                  const SizedBox(width: 10),
                  _InfoCard(Icons.location_on_outlined, 'Zone', zone, AppColors.teal),
                ]),

                // Key factors
                if (_frame?['key_factors'] != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _surface,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8, offset: const Offset(0, 2))],
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Icon(Icons.info_outline_rounded,
                            size: 14, color: AppColors.accentBlue),
                        const SizedBox(width: 6),
                        const Text('Key Observations',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                                color: _text)),
                      ]),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6, runSpacing: 6,
                        children: ((_frame!['key_factors'] as List?) ?? [])
                            .map<Widget>((f) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                border: Border.all(color: color.withValues(alpha: 0.3)),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(f.toString(),
                                  style: TextStyle(fontSize: 10, color: color,
                                      fontWeight: FontWeight.w600)),
                            )).toList(),
                      ),
                    ]),
                  ),
                ],

                const SizedBox(height: 16),

                // View Details button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => PatientDetailScreen(
                          patient: {
                            'room_id': widget.roomId,
                            'patient_code': widget.patientCode,
                          },
                        ))),
                    icon: const Icon(Icons.bed_outlined, size: 16),
                    label: const Text('View Room / Bed Details',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentBlue,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Skeleton painter ─────────────────────────────────────────────────────────
class _SkeletonPainter extends CustomPainter {
  final Map<String, dynamic>? frame;
  final String level;
  const _SkeletonPainter(this.frame, this.level);

  Color get _boneColor  => level == 'HIGH'     ? const Color(0xFFEF4444)
                         : level == 'MODERATE' ? const Color(0xFFF59E0B)
                         : const Color(0xFF22C55E);
  Color get _jointColor => level == 'HIGH'     ? const Color(0xFFDC2626)
                         : level == 'MODERATE' ? const Color(0xFFD97706)
                         : const Color(0xFF16A34A);

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width;
    final H = size.height;

    canvas.drawRect(Rect.fromLTWH(0, 0, W, H),
        Paint()..color = const Color(0xFF060D1A));

    // Grid
    final gridP = Paint()..color = Colors.white.withValues(alpha: 0.04)..strokeWidth = 1;
    for (double x = 0; x <= W; x += 44) canvas.drawLine(Offset(x, 0), Offset(x, H), gridP);
    for (double y = 0; y <= H; y += 44) canvas.drawLine(Offset(0, y), Offset(W, y), gridP);

    // LIVE badge
    final liveP = Paint()..color = const Color(0xFF22C55E).withValues(alpha: 0.18);
    canvas.drawRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(12, 12, 48, 20), const Radius.circular(5)), liveP);
    (TextPainter(
      text: const TextSpan(text: '● LIVE',
          style: TextStyle(color: Color(0xFF4ADE80), fontSize: 9,
              fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout()).paint(canvas, const Offset(16, 16));

    final rawSkel = frame?['skeleton'];
    if (rawSkel == null || (rawSkel as List).isEmpty) {
      final waitTp = TextPainter(
        text: const TextSpan(text: 'Waiting for skeleton data...',
            style: TextStyle(color: Color(0x6094A3B8), fontSize: 13)),
        textDirection: TextDirection.ltr,
      )..layout();
      waitTp.paint(canvas, Offset((W - waitTp.width) / 2, (H - waitTp.height) / 2));
      return;
    }

    final joints = (rawSkel as List).map<List<double>>((j) {
      final jl = j as List;
      return [
        (jl[0] as num).toDouble(),
        (jl[1] as num).toDouble(),
        jl.length > 2 ? (jl[2] as num).toDouble() : 0.0,
        jl.length > 3 ? (jl[3] as num).toDouble() : 1.0,
      ];
    }).toList();

    bool vis(int i) => i < joints.length && joints[i][3] > 0.1;
    double px(int i) => joints[i][0] * W;
    double py(int i) => joints[i][1] * H;

    // Bones
    final boneP = Paint()
      ..color = _boneColor.withValues(alpha: 0.85)
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final bone in kBones) {
      if (!vis(bone[0]) || !vis(bone[1])) continue;
      canvas.drawLine(Offset(px(bone[0]), py(bone[0])),
          Offset(px(bone[1]), py(bone[1])), boneP);
    }

    // Joints
    for (int i = 0; i < joints.length; i++) {
      if (!vis(i)) continue;
      final r = i == 0 ? 9.0 : 5.5;
      canvas.drawCircle(Offset(px(i), py(i)), r,
          Paint()..color = i == 0 ? const Color(0xFFFCD34D) : _jointColor);
      canvas.drawCircle(Offset(px(i), py(i)), r,
          Paint()..color = Colors.white.withValues(alpha: 0.2)
              ..strokeWidth = 1.5..style = PaintingStyle.stroke);
    }

    // Score overlay
    final score = frame?['risk_score'];
    if (score != null) {
      final scoreStr = '${(score as num).toStringAsFixed(0)}/100';
      final tp = TextPainter(
        text: TextSpan(text: scoreStr,
            style: TextStyle(color: _boneColor, fontSize: 16,
                fontWeight: FontWeight.w900)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(W - tp.width - 12, 14));
    }

    // Posture
    final posture = frame?['posture'];
    if (posture != null) {
      final tp = TextPainter(
        text: TextSpan(text: posture.toString().toUpperCase(),
            style: const TextStyle(color: Color(0x8094A3B8), fontSize: 10,
                fontWeight: FontWeight.w600)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(12, H - tp.height - 12));
    }
  }

  @override
  bool shouldRepaint(_SkeletonPainter old) =>
      old.frame != frame || old.level != level;
}

// ── Metric card ──────────────────────────────────────────────────────────────
class _MetricCard extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _MetricCard({required this.icon, required this.label,
      required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
          color: color.withValues(alpha: 0.1),
          blurRadius: 10, offset: const Offset(0, 3))],
      ),
      child: Column(children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900,
            color: color)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 9, color: _muted),
            textAlign: TextAlign.center),
      ]),
    ));
  }
}

// ── Info card ────────────────────────────────────────────────────────────────
class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _InfoCard(this.icon, this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            children: [
          Text(label, style: TextStyle(fontSize: 9, color: _muted)),
          Text(value,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                  color: _text),
              overflow: TextOverflow.ellipsis),
        ])),
      ]),
    ));
  }
}
