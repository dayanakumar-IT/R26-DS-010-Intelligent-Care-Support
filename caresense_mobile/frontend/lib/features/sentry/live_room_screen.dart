import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../core/constants/colors.dart';
import '../../core/config/api_config.dart';

// â”€â”€ Bone pairs â€” 14-joint MediaPipe subset (matches backend config/settings.py)
const List<List<int>> kBones = [
  [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [1, 8], [1, 9], [8, 10], [9, 11], [10, 12], [11, 13],
];

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
        Uri.parse('$wsUrl/ws/live/${widget.roomId}'),
      );
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
    if (!mounted) return;
    setState(() { _connected = false; });
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) _connect();
    });
  }

  @override
  void dispose() {
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
    final posture   = _frame?['posture']   ?? 'â€”';
    final zone      = _frame?['zone']      ?? 'â€”';
    final conf      = _frame?['confidence'];
    final color     = _levelColor(level);
    final scoreText = score != null ? '${score.toStringAsFixed(0)}/100' : 'â€”';
    final confText  = conf  != null ? '${(conf * 100).toStringAsFixed(0)}%' : 'â€”';

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(children: [
          // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Row(children: [
                  const Icon(Icons.arrow_back_ios_rounded, size: 16, color: AppColors.primary),
                  Text('${widget.roomId} Â· ${widget.patientCode}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
                ]),
              ),
              const Spacer(),
              // Connection indicator
              Row(children: [
                Container(width: 7, height: 7,
                    decoration: BoxDecoration(
                        color: _connected ? AppColors.low : AppColors.high,
                        shape: BoxShape.circle)),
                const SizedBox(width: 5),
                Text(_connected ? 'LIVE' : 'Reconnectingâ€¦',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                        color: _connected ? AppColors.low : AppColors.high)),
              ]),
            ]),
          ),

          // â”€â”€ Skeleton canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: double.infinity,
              height: MediaQuery.of(context).size.height * 0.42,
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(12),
              ),
              clipBehavior: Clip.antiAlias,
              child: CustomPaint(
                painter: _SkeletonPainter(_frame, level),
                child: const SizedBox.expand(),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // â”€â”€ Metrics row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              _MetricBox('Risk Score', scoreText, color),
              const SizedBox(width: 8),
              _MetricBox('Confidence', confText, AppColors.primary),
              const SizedBox(width: 8),
              _MetricBox('Risk Level', level == 'MODERATE' ? 'MOD' : level, color),
            ]),
          ),
          const SizedBox(height: 10),

          // â”€â”€ Info cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              _InfoCard(Icons.accessibility_new_rounded, 'Posture', posture, AppColors.primary),
              const SizedBox(width: 8),
              _InfoCard(Icons.location_on_outlined, 'Zone', zone, AppColors.teal),
            ]),
          ),
          const SizedBox(height: 12),

          // â”€â”€ Key factors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (_frame?['key_factors'] != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  border: Border.all(color: AppColors.borderLight),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Key Observations',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6, runSpacing: 4,
                    children: ((_frame!['key_factors'] as List?) ?? []).map<Widget>((f) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          border: Border.all(color: color.withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(f.toString(),
                            style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
                      );
                    }).toList(),
                  ),
                ]),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

// â”€â”€ Skeleton CustomPainter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _SkeletonPainter extends CustomPainter {
  final Map<String, dynamic>? frame;
  final String level;
  const _SkeletonPainter(this.frame, this.level);

  Color get _boneColor  => level == 'HIGH' ? const Color(0xFFEF4444)
                         : level == 'MODERATE' ? const Color(0xFFF59E0B)
                         : const Color(0xFF22C55E);
  Color get _jointColor => level == 'HIGH' ? const Color(0xFFDC2626)
                         : level == 'MODERATE' ? const Color(0xFFD97706)
                         : const Color(0xFF16A34A);
  Color get _headColor  => level == 'HIGH' ? const Color(0xFFB91C1C)
                         : level == 'MODERATE' ? const Color(0xFFB45309)
                         : const Color(0xFF15803D);

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width;
    final H = size.height;

    // Background
    canvas.drawRect(Rect.fromLTWH(0, 0, W, H),
        Paint()..color = const Color(0xFF0F172A));

    // Subtle grid
    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1;
    for (double x = 0; x <= W; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, H), gridPaint);
    }
    for (double y = 0; y <= H; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(W, y), gridPaint);
    }

    final rawSkel = frame?['skeleton'];
    if (rawSkel == null || (rawSkel as List).isEmpty) {
      // "Waiting" text
      final tp = TextPainter(
        text: const TextSpan(
          text: 'Waiting for skeleton dataâ€¦',
          style: TextStyle(color: Color(0x8094A3B8), fontSize: 13),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset((W - tp.width) / 2, (H - tp.height) / 2));
      return;
    }

    // Parse joints: [[x,y,z,v], ...]
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

    // Draw bones
    final bonePaint = Paint()
      ..color = _boneColor.withValues(alpha: 0.85)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final bone in kBones) {
      final a = bone[0], b = bone[1];
      if (!vis(a) || !vis(b)) continue;
      canvas.drawLine(Offset(px(a), py(a)), Offset(px(b), py(b)), bonePaint);
    }

    // Draw joints
    for (int i = 0; i < joints.length; i++) {
      if (!vis(i)) continue;
      final r = i == 0 ? 8.0 : 5.0;
      // Fill
      canvas.drawCircle(Offset(px(i), py(i)), r,
          Paint()..color = (i == 0 ? _headColor : _jointColor));
      // Outline
      canvas.drawCircle(Offset(px(i), py(i)), r,
          Paint()
            ..color = Colors.white.withValues(alpha: 0.3)
            ..strokeWidth = 1.5
            ..style = PaintingStyle.stroke);
    }

    // Risk score overlay text
    final score = frame?['risk_score'];
    if (score != null) {
      final tp = TextPainter(
        text: TextSpan(
          text: '${(score as num).toStringAsFixed(0)}/100',
          style: TextStyle(color: _boneColor, fontSize: 14, fontWeight: FontWeight.w800),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, const Offset(12, 12));
    }

    // Posture overlay
    final posture = frame?['posture'];
    if (posture != null) {
      final tp = TextPainter(
        text: TextSpan(
          text: posture.toString(),
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(12, H - tp.height - 12));
    }
  }

  @override
  bool shouldRepaint(_SkeletonPainter old) =>
      old.frame != frame || old.level != level;
}

// â”€â”€ Helper widgets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _MetricBox extends StatelessWidget {
  final String label, value;
  final Color color;
  const _MetricBox(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        Text(label, style: TextStyle(fontSize: 9, color: AppColors.mutedLight)),
      ]),
    ));
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _InfoCard(this.icon, this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 9, color: AppColors.mutedLight)),
          Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textLight),
              overflow: TextOverflow.ellipsis),
        ])),
      ]),
    ));
  }
}
