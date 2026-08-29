import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../core/services/sound_service.dart';
import '../../widgets/module_switcher_pill.dart';
import 'event_replay_screen.dart';

const _bg      = AppColors.bgDark;
const _surface = AppColors.surfaceDark;
const _border  = AppColors.borderDark;
const _text    = AppColors.textDark;
const _muted   = AppColors.mutedDark;
const _dim     = AppColors.dimDark;

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  String _filter = 'All';
  // Local list for immediate ACK removal without reload flash
  List<Map<String, dynamic>>? _localAlerts;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    setState(() => _localAlerts = null);
    SentryService.getAlerts(unackedOnly: false).then((list) {
      final unacked = list.where((a) => a['acknowledged_at'] == null).toList();
      if (mounted) setState(() => _localAlerts = List.from(unacked));
    });
  }

  Future<void> _ack(Map<String, dynamic> alert) async {
    final id = alert['id'];
    if (id == null) return;

    // 1. Immediately remove from local list for snappy UX
    setState(() {
      _localAlerts?.removeWhere((a) => a['id'] == id);
    });

    // 2. Stop HIGH sound if this was the triggering alert
    if ((alert['risk_level'] ?? '') == 'HIGH') {
      SoundService.stopHighAlert();
    }

    // 3. Persist to backend
    try {
      await SentryService.acknowledgeAlert(id as int);
    } catch (_) {
      // If backend fails, reload to get accurate state
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [
          // ── Header ────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Alerts',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _text)),
                Row(children: [
                  Container(width: 6, height: 6,
                      decoration: const BoxDecoration(color: AppColors.high, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text('Unacknowledged fall-risk alerts',
                      style: TextStyle(fontSize: 11, color: AppColors.high)),
                ]),
              ]),
              Row(children: [
                IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    color: _muted,
                    onPressed: _load),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // ── Filter tabs ───────────────────────────────────────────────
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: ['All', 'High', 'Moderate', 'Low'].map((f) {
              final active = _filter == f;
              final color = f == 'High' ? AppColors.high
                          : f == 'Moderate' ? AppColors.moderate
                          : f == 'Low' ? AppColors.low
                          : AppColors.accentBlue;
              return GestureDetector(
                onTap: () => setState(() => _filter = f),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                  decoration: BoxDecoration(
                    color: active ? color : color.withValues(alpha: 0.08),
                    border: Border.all(color: active ? color : color.withValues(alpha: 0.25)),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(f, style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700,
                    color: active ? Colors.white : color,
                  )),
                ),
              );
            }).toList()),
          ),
          const SizedBox(height: 12),

          // ── Alert list ────────────────────────────────────────────────
          Expanded(
            child: _localAlerts == null
                ? const Center(child: CircularProgressIndicator(color: AppColors.high, strokeWidth: 2))
                : _buildList(_localAlerts!),
          ),
        ]),
      ),
    );
  }

  Widget _buildList(List<Map<String, dynamic>> source) {
    var alerts = List<Map<String, dynamic>>.from(source);

    // Filter
    if (_filter != 'All') {
      final lvl = _filter.toUpperCase() == 'LOW' ? 'NORMAL' : _filter.toUpperCase();
      alerts = alerts.where((a) => (a['risk_level'] ?? '') == lvl).toList();
    }

    if (alerts.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('✅', style: TextStyle(fontSize: 40)),
        const SizedBox(height: 12),
        Text(_filter == 'All' ? 'No active alerts — all clear!'
                              : 'No ${_filter.toLowerCase()} alerts',
            style: TextStyle(color: _muted, fontSize: 13)),
      ]));
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: alerts.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text('Active · ${alerts.length} alert${alerts.length == 1 ? '' : 's'}',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _muted)),
        );
        return _AlertCard(
          alerts[i - 1],
          onAck: () => _ack(alerts[i - 1]),
          onReplay: () => Navigator.push(context,
              MaterialPageRoute(builder: (_) => EventReplayScreen(alert: alerts[i - 1]))),
        );
      },
    );
  }
}

// ── Alert card ───────────────────────────────────────────────────────────────
class _AlertCard extends StatelessWidget {
  final Map<String, dynamic> a;
  final VoidCallback onAck;
  final VoidCallback onReplay;
  const _AlertCard(this.a, {required this.onAck, required this.onReplay});

  @override
  Widget build(BuildContext context) {
    final level = (a['risk_level'] ?? 'NORMAL').toString();
    final color = level == 'HIGH' ? AppColors.high
                : level == 'MODERATE' ? AppColors.moderate
                : AppColors.low;
    final icon  = level == 'HIGH' ? '🚨' : level == 'MODERATE' ? '⚠️' : '✅';
    final label = level == 'HIGH' ? 'High risk · Immediate attention'
                : level == 'MODERATE' ? 'Unstable movement detected' : 'Stable';
    final time  = (a['created_at'] ?? '').toString();
    final timeStr = time.length >= 16 ? time.substring(11, 16) : '—';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: _surface,
        border: Border(
          left: BorderSide(color: color, width: 4),
          top: BorderSide(color: color.withValues(alpha: 0.2)),
          right: BorderSide(color: _border),
          bottom: BorderSide(color: _border),
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // ── Top row ────────────────────────────────────────────────
          Row(children: [
            Text(icon, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 8),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Room ${a['room_id'] ?? '—'} · Patient ${a['patient_id'] ?? '—'}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: _text)),
              Text(label, style: TextStyle(fontSize: 11, color: _muted)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(5)),
                child: Text(level == 'MODERATE' ? 'MOD' : level,
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: 3),
              Text(timeStr, style: TextStyle(fontSize: 10, color: _dim)),
            ]),
          ]),
          const SizedBox(height: 10),

          // ── Action buttons ──────────────────────────────────────────
          Row(children: [
            // Replay button
            Expanded(
              child: GestureDetector(
                onTap: onReplay,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.accentBlue.withValues(alpha: 0.12),
                    border: Border.all(color: AppColors.accentBlue.withValues(alpha: 0.35)),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.replay_rounded, size: 14, color: AppColors.accentBlue),
                    SizedBox(width: 4),
                    Text('Replay', style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.accentBlue)),
                  ]),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // ACK button
            Expanded(
              child: GestureDetector(
                onTap: onAck,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    border: Border.all(color: color.withValues(alpha: 0.4)),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.check_circle_outline, size: 14, color: color),
                    const SizedBox(width: 4),
                    Text('Acknowledge', style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                  ]),
                ),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}
