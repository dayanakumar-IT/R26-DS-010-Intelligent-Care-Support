import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../core/constants/colors.dart';
import '../../core/config/api_config.dart';
import 'patient_detail_screen.dart';

// Bone pairs — 14-joint MediaPipe subset
const List<List<int>> kBones = [
  [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [1, 8], [1, 9], [8, 10], [9, 11], [10, 12], [11, 13],
];

class LiveRoomScreen extends StatefulWidget {
  final String roomId;
  final String patientCode;
  const LiveRoomScreen(
      {super.key, required this.roomId, required this.patientCode});
  @override
  State<LiveRoomScreen> createState() => _LiveRoomScreenState();
}

class _LiveRoomScreenState extends State<LiveRoomScreen> {
  WebSocketChannel? _channel;
  bool _connected = false;
  bool _disposed  = false;
  Timer? _reconnectTimer;

  // ValueNotifier so canvas repaints without rebuilding the whole tree
  final _frameNotifier = ValueNotifier<Map<String, dynamic>?>( null);

  // Separate notifier for UI metrics (less frequent — only on full updates)
  final _metricsNotifier = ValueNotifier<Map<String, dynamic>?>( null);

  @override
  void initState() {
    super.initState();
    _connect();
  }

  @override
  void dispose() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _frameNotifier.dispose();
    _metricsNotifier.dispose();
    super.dispose();
  }

  void _connect() {
    try {
      final wsUrl = ApiConfig.baseUrl
          .replaceFirst('http://', 'ws://')
          .replaceFirst('https://', 'wss://');
      _channel = WebSocketChannel.connect(
          Uri.parse('$wsUrl/ws/live/${widget.roomId}'));
      if (mounted) setState(() => _connected = true);

      _channel!.stream.listen(
        (raw) {
          try {
            final data = jsonDecode(raw as String) as Map<String, dynamic>;
            if (_disposed) return;

            final msgType = data['type']?.toString() ?? '';

            if (msgType == 'skeleton') {
              // Lightweight skeleton-only frame: merge into existing frame
              // preserving risk metrics so the bottom panel never goes blank
              final prev = _frameNotifier.value ?? {};
              _frameNotifier.value = {
                ...prev,
                'skeleton': data['skeleton'],
              };
            } else {
              // Full update: replace everything (risk_score, posture, zone,
              // confidence, key_factors, risk_level, skeleton)
              _frameNotifier.value = data;
              // Separately notify the metrics panel so it re-renders
              _metricsNotifier.value = data;
            }
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
    _reconnectTimer =
        Timer(const Duration(seconds: 3), () { if (mounted) _connect(); });
  }

  Color _levelColor(String? l) {
    final u = (l ?? '').toUpperCase();
    return u == 'HIGH'     ? AppColors.high
         : u == 'MODERATE' ? AppColors.moderate
         : AppColors.low;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF060D1A),
      body: Stack(children: [

        // ── Full-screen skeleton canvas (repaints independently via ValueNotifier)
        Positioned.fill(
          child: RepaintBoundary(
            child: ValueListenableBuilder<Map<String, dynamic>?>(
              valueListenable: _frameNotifier,
              builder: (_, frame, __) => CustomPaint(
                painter: _SkeletonPainter(frame, _levelColor(
                  frame?['risk_level']?.toString())),
              ),
            ),
          ),
        ),

        // ── Top overlay bar (back + title + risk badge) ──────────────────
        Positioned(
          top: 0, left: 0, right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: ValueListenableBuilder<Map<String, dynamic>?>(
                valueListenable: _metricsNotifier,
                builder: (_, metrics, __) {
                  final level = (metrics?['risk_level'] ?? 'NORMAL').toString().toUpperCase();
                  final color = _levelColor(level);
                  return Row(children: [
                    // Back button
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.45),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        child: const Icon(Icons.arrow_back_ios_rounded,
                            size: 15, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 10),
                    // Title
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${widget.roomId}  ·  ${widget.patientCode}',
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w800,
                                color: Colors.white)),
                        Row(children: [
                          Container(width: 6, height: 6,
                              decoration: BoxDecoration(
                                color: _connected
                                    ? const Color(0xFF4ADE80) : AppColors.high,
                                shape: BoxShape.circle)),
                          const SizedBox(width: 5),
                          Text(_connected ? 'LIVE' : 'Reconnecting...',
                              style: TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700,
                                color: _connected
                                    ? const Color(0xFF4ADE80) : AppColors.high,
                              )),
                        ]),
                      ],
                    )),
                    // Risk badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: color.withValues(alpha: 0.6)),
                      ),
                      child: Text(
                        level == 'MODERATE' ? 'MOD RISK'
                            : level == 'HIGH' ? 'HIGH RISK' : 'NORMAL',
                        style: TextStyle(fontSize: 11,
                            fontWeight: FontWeight.w800, color: color),
                      ),
                    ),
                  ]);
                },
              ),
            ),
          ),
        ),

        // ── Bottom floating info panel ───────────────────────────────────
        Positioned(
          bottom: 0, left: 0, right: 0,
          child: SafeArea(
            top: false,
            child: ValueListenableBuilder<Map<String, dynamic>?>(
              valueListenable: _metricsNotifier,
              builder: (_, metrics, __) {
                final level   = (metrics?['risk_level'] ?? 'NORMAL').toString().toUpperCase();
                final score   = metrics?['risk_score'];
                final posture = (metrics?['posture']   ?? '--').toString();
                final zone    = (metrics?['zone']      ?? '--').toString();
                final conf    = metrics?['confidence'];
                final color   = _levelColor(level);
                final scoreStr = score != null
                    ? '${(score as num).toStringAsFixed(0)}/100' : '--';
                final confStr  = conf != null
                    ? '${((conf as num) * 100).toStringAsFixed(0)}%' : '--';
                final factors  = (metrics?['key_factors'] as List?)
                    ?.map((e) => e.toString()).toList() ?? [];

                return Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D1B2E).withValues(alpha: 0.96),
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(24)),
                    border: Border(
                      top: BorderSide(color: color.withValues(alpha: 0.3)),
                    ),
                  ),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [

                    // Drag handle
                    Padding(
                      padding: const EdgeInsets.only(top: 10, bottom: 6),
                      child: Container(
                        width: 36, height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(2)),
                      ),
                    ),

                    // Metric row
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                      child: Row(children: [
                        _MetricChip(
                            icon: Icons.speed_rounded,
                            label: 'Score',
                            value: scoreStr,
                            color: color),
                        const SizedBox(width: 8),
                        _MetricChip(
                            icon: Icons.track_changes_rounded,
                            label: 'Confidence',
                            value: confStr,
                            color: AppColors.accentBlue),
                        const SizedBox(width: 8),
                        _MetricChip(
                            icon: Icons.accessibility_new_rounded,
                            label: 'Posture',
                            value: posture,
                            color: AppColors.teal),
                        const SizedBox(width: 8),
                        _MetricChip(
                            icon: Icons.location_on_rounded,
                            label: 'Zone',
                            value: zone,
                            color: const Color(0xFF8B5CF6)),
                      ]),
                    ),

                    // Key factors (if any)
                    if (factors.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: Row(children: [
                          Icon(Icons.info_outline_rounded,
                              size: 13,
                              color: Colors.white.withValues(alpha: 0.5)),
                          const SizedBox(width: 6),
                          Expanded(child: Wrap(spacing: 5, runSpacing: 4,
                            children: factors.take(3).map((f) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.15),
                                border: Border.all(
                                    color: color.withValues(alpha: 0.3)),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(f, style: TextStyle(
                                  fontSize: 9, color: color,
                                  fontWeight: FontWeight.w600)),
                            )).toList(),
                          )),
                        ]),
                      ),

                    // View Details button
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => Navigator.push(context,
                              MaterialPageRoute(
                                  builder: (_) => PatientDetailScreen(
                                    patient: {
                                      'room_id': widget.roomId,
                                      'patient_code': widget.patientCode,
                                    },
                                  ))),
                          icon: const Icon(Icons.bed_outlined, size: 16),
                          label: const Text('View Room / Bed Details',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w700)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentBlue,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding:
                                const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ),
                  ]),
                );
              },
            ),
          ),
        ),

        // ── No camera warning (when waiting) ────────────────────────────
        ValueListenableBuilder<Map<String, dynamic>?>(
          valueListenable: _frameNotifier,
          builder: (_, frame, __) {
            if (frame != null || !_connected) return const SizedBox.shrink();
            return Positioned(
              bottom: 260,
              left: 0, right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.videocam_off_rounded,
                        size: 14,
                        color: Colors.white.withValues(alpha: 0.6)),
                    const SizedBox(width: 6),
                    Text('Plug in camera to start monitoring',
                        style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.7),
                            fontWeight: FontWeight.w500)),
                  ]),
                ),
              ),
            );
          },
        ),
      ]),
    );
  }
}

// ── Skeleton painter (full-screen, dark bg) ───────────────────────────────────
class _SkeletonPainter extends CustomPainter {
  final Map<String, dynamic>? frame;
  final Color boneColor;

  _SkeletonPainter(this.frame, Color color)
      : boneColor = color,
        super(repaint: null);

  Color get _jointColor => boneColor;

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width;
    final H = size.height;

    // Full dark background
    canvas.drawRect(Rect.fromLTWH(0, 0, W, H),
        Paint()..color = const Color(0xFF060D1A));

    // Subtle grid
    final gridP = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..strokeWidth = 1;
    for (double x = 0; x <= W; x += 50)
      canvas.drawLine(Offset(x, 0), Offset(x, H), gridP);
    for (double y = 0; y <= H; y += 50)
      canvas.drawLine(Offset(0, y), Offset(W, y), gridP);

    final rawSkel = frame?['skeleton'];
    if (rawSkel == null || (rawSkel as List).isEmpty) {
      // Waiting text
      final tp = TextPainter(
        text: const TextSpan(text: 'Waiting for skeleton data...',
            style: TextStyle(color: Color(0x4094A3B8), fontSize: 14)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset((W - tp.width) / 2, H * 0.42));
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

    // Glow effect for bones
    final glowP = Paint()
      ..color = boneColor.withValues(alpha: 0.15)
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final bone in kBones) {
      if (!vis(bone[0]) || !vis(bone[1])) continue;
      canvas.drawLine(Offset(px(bone[0]), py(bone[0])),
          Offset(px(bone[1]), py(bone[1])), glowP);
    }

    // Bones
    final boneP = Paint()
      ..color = boneColor.withValues(alpha: 0.9)
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
      final r = i == 0 ? 11.0 : 6.0;
      final jColor = i == 0 ? const Color(0xFFFCD34D) : _jointColor;
      // Glow
      canvas.drawCircle(Offset(px(i), py(i)), r + 4,
          Paint()..color = jColor.withValues(alpha: 0.12));
      // Fill
      canvas.drawCircle(Offset(px(i), py(i)), r,
          Paint()..color = jColor);
      // Ring
      canvas.drawCircle(Offset(px(i), py(i)), r,
          Paint()
            ..color = Colors.white.withValues(alpha: 0.25)
            ..strokeWidth = 1.5
            ..style = PaintingStyle.stroke);
    }

    // Risk score top-right overlay
    final score = frame?['risk_score'];
    if (score != null) {
      final scoreStr = '${(score as num).toStringAsFixed(0)}/100';
      final tp = TextPainter(
        text: TextSpan(text: scoreStr,
            style: TextStyle(
                color: boneColor, fontSize: 18,
                fontWeight: FontWeight.w900,
                shadows: [Shadow(color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 4)])),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(W - tp.width - 16, H * 0.12));
    }
  }

  @override
  bool shouldRepaint(_SkeletonPainter old) =>
      old.frame != frame || old.boneColor != boneColor;
}

// ── Metric chip ───────────────────────────────────────────────────────────────
class _MetricChip extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _MetricChip(
      {required this.icon, required this.label,
       required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 4),
        Text(value,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900,
                color: color),
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center),
        const SizedBox(height: 1),
        Text(label,
            style: TextStyle(fontSize: 8,
                color: Colors.white.withValues(alpha: 0.5)),
            textAlign: TextAlign.center),
      ]),
    ));
  }
}
