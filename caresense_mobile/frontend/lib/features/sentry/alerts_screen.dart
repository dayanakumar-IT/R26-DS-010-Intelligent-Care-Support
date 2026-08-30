import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../core/services/sound_service.dart';
import '../../widgets/module_switcher_pill.dart';
import 'event_replay_screen.dart';

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen>
    with SingleTickerProviderStateMixin {
  String _filter = 'all';
  List<Map<String, dynamic>>? _localAlerts;
  late final AnimationController _bannerCtrl;
  late final Animation<double> _bannerAnim;

  @override
  void initState() {
    super.initState();
    _bannerCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _bannerAnim = CurvedAnimation(parent: _bannerCtrl, curve: Curves.easeOut);
    _load();
  }

  @override
  void dispose() {
    _bannerCtrl.dispose();
    super.dispose();
  }

  void _load() {
    setState(() => _localAlerts = null);
    SentryService.getAlerts(unackedOnly: false).then((list) {
      if (mounted) {
        setState(() => _localAlerts = List.from(list));
        final unack = list.where((a) => a['acknowledged_at'] == null).length;
        if (unack > 0) _bannerCtrl.forward();
      }
    });
  }

  Future<void> _ack(Map<String, dynamic> alert) async {
    final id = alert['id'];
    if (id == null) return;
    setState(() {
      final idx = _localAlerts?.indexWhere((a) => a['id'] == id) ?? -1;
      if (idx >= 0) {
        _localAlerts![idx] = {
          ..._localAlerts![idx],
          'acknowledged_at': DateTime.now().toIso8601String()
        };
      }
    });
    if ((alert['risk_level'] ?? '') == 'HIGH') SoundService.stopHighAlert();
    try {
      await SentryService.acknowledgeAlert(id as int);
    } catch (_) {
      _load();
    }
  }

  List<Map<String, dynamic>> get _shown {
    final list = _localAlerts ?? [];
    if (_filter == 'unacked') return list.where((a) => a['acknowledged_at'] == null).toList();
    if (_filter == 'high')    return list.where((a) => (a['risk_level'] ?? '') == 'HIGH').toList();
    if (_filter == 'moderate') return list.where((a) => (a['risk_level'] ?? '') == 'MODERATE').toList();
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final all   = _localAlerts ?? [];
    final high  = all.where((a) => (a['risk_level'] ?? '') == 'HIGH').length;
    final mod   = all.where((a) => (a['risk_level'] ?? '') == 'MODERATE').length;
    final unack = all.where((a) => a['acknowledged_at'] == null).length;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [

          // ── Header ──────────────────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: _surface,
              boxShadow: [BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8, offset: const Offset(0, 2))],
            ),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Alerts',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800,
                        color: _text)),
                Text('${all.length} total  ·  $unack unacknowledged',
                    style: TextStyle(fontSize: 11, color: _muted)),
              ]),
              Row(children: [
                GestureDetector(
                  onTap: _load,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _bg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _border),
                    ),
                    child: Icon(Icons.refresh_rounded, size: 18, color: _muted),
                  ),
                ),
                const SizedBox(width: 8),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // ── Unacked banner (animated) ────────────────────────────────────
          if (unack > 0)
            SizeTransition(
              sizeFactor: _bannerAnim,
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.high.withValues(alpha: 0.15),
                             AppColors.high.withValues(alpha: 0.05)],
                  ),
                  border: Border.all(color: AppColors.high.withValues(alpha: 0.35)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.high.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.warning_rounded,
                        color: AppColors.high, size: 16),
                  ),
                  const SizedBox(width: 10),
                  Column(crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    const Text('Requires Attention',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                            color: AppColors.high)),
                    Text('$unack unacknowledged alert${unack > 1 ? 's' : ''}',
                        style: TextStyle(fontSize: 11, color: _muted)),
                  ]),
                ]),
              ),
            ),

          const SizedBox(height: 12),

          // ── Filter pills ─────────────────────────────────────────────────
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              _FilterPill('All', 'all', _filter, null, all.length,
                  () => setState(() => _filter = 'all')),
              _FilterPill('High', 'high', _filter, AppColors.high, high,
                  () => setState(() => _filter = 'high')),
              _FilterPill('Moderate', 'moderate', _filter, AppColors.moderate, mod,
                  () => setState(() => _filter = 'moderate')),
              _FilterPill('Unacked', 'unacked', _filter,
                  AppColors.accentBlue, unack,
                  () => setState(() => _filter = 'unacked')),
            ]),
          ),
          const SizedBox(height: 10),

          // ── Alert list ───────────────────────────────────────────────────
          Expanded(
            child: _localAlerts == null
                ? const Center(child: CircularProgressIndicator(
                    color: AppColors.high, strokeWidth: 2))
                : _buildList(),
          ),
        ]),
      ),
    );
  }

  Widget _buildList() {
    final list = _shown;
    if (list.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: AppColors.low.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle_outline_rounded,
              size: 36, color: AppColors.low),
        ),
        const SizedBox(height: 14),
        const Text('All Clear!',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800,
                color: AppColors.low)),
        const SizedBox(height: 4),
        Text(
          _filter == 'unacked' ? 'All alerts have been acknowledged'
              : 'No alerts match this filter',
          style: TextStyle(color: _muted, fontSize: 12),
        ),
      ]));
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      itemCount: list.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('Showing ${list.length} of ${(_localAlerts ?? []).length} alerts',
                style: TextStyle(fontSize: 11, color: _dim)),
          );
        }
        final a = list[i - 1];
        return _AlertCard(
          a,
          onAck: () => _ack(a),
          onReplay: () => Navigator.push(context,
              MaterialPageRoute(builder: (_) => EventReplayScreen(alert: a))),
        );
      },
    );
  }
}

// ── Filter pill ──────────────────────────────────────────────────────────────
class _FilterPill extends StatelessWidget {
  final String label, tabKey, active;
  final Color? color;
  final int count;
  final VoidCallback onTap;
  const _FilterPill(this.label, this.tabKey, this.active, this.color,
      this.count, this.onTap);

  @override
  Widget build(BuildContext context) {
    final isActive = tabKey == active;
    final c = color ?? AppColors.accentBlue;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(right: 8, bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? c : _surface,
          border: Border.all(color: isActive ? c : _border),
          borderRadius: BorderRadius.circular(20),
          boxShadow: isActive ? [BoxShadow(
            color: c.withValues(alpha: 0.25),
            blurRadius: 8, offset: const Offset(0, 2))] : [],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w700,
            color: isActive ? Colors.white : _muted,
          )),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: isActive
                  ? Colors.white.withValues(alpha: 0.25)
                  : c.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('$count', style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w800,
              color: isActive ? Colors.white : c,
            )),
          ),
        ]),
      ),
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
    final level  = (a['risk_level'] ?? 'NORMAL').toString();
    final acked  = a['acknowledged_at'] != null;
    final color  = level == 'HIGH'     ? AppColors.high
                 : level == 'MODERATE' ? AppColors.moderate
                 : AppColors.low;

    final rawTime = (a['created_at'] ?? a['timestamp'] ?? '').toString();
    final timeStr = rawTime.length >= 16 ? rawTime.substring(11, 16)
        : (rawTime.length >= 10 ? rawTime.substring(0, 10) : '--');
    final score    = a['risk_score'];
    final scoreStr = score != null
        ? '${((score as num) * (score > 1 ? 1 : 100)).round()}'
        : '--';
    final posture  = (a['posture'] ?? '--').toString();
    final factors  = (a['key_factors'] as List?)?.take(2).join(', ') ?? '--';
    final roomId   = a['room_id']?.toString() ?? '--';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: acked ? _surface : _surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(
          color: acked
              ? Colors.black.withValues(alpha: 0.04)
              : color.withValues(alpha: 0.12),
          blurRadius: 10, offset: const Offset(0, 3))],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Left color strip
          Container(width: 5, color: acked ? _dim : color),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                  children: [

                // Top row: time + room + status + badge
                Row(children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: (acked ? _dim : color).withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      level == 'HIGH'     ? Icons.warning_rounded
                          : level == 'MODERATE' ? Icons.warning_amber_rounded
                          : Icons.check_circle_outline,
                      size: 14,
                      color: acked ? _dim : color,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(timeStr, style: TextStyle(fontSize: 11, color: _muted,
                      fontWeight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  Text('Room $roomId',
                      style: TextStyle(fontSize: 11, color: _dim)),
                  const Spacer(),
                  // Status pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: acked
                          ? _dim.withValues(alpha: 0.15)
                          : AppColors.high.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(acked ? 'Acked' : 'New',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700,
                            color: acked ? _dim : AppColors.high)),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                        color: acked ? _dim : color,
                        borderRadius: BorderRadius.circular(10)),
                    child: Text(level == 'MODERATE' ? 'MOD' : level,
                        style: const TextStyle(color: Colors.white, fontSize: 9,
                            fontWeight: FontWeight.w800)),
                  ),
                ]),
                const SizedBox(height: 10),

                // Data row: Score | Posture | Key Factors
                Row(children: [
                  _DataCell('Score', scoreStr, acked ? _muted : color),
                  _vDivider(),
                  _DataCell('Posture', posture, _muted),
                  _vDivider(),
                  Expanded(child: _DataCell('Key Factors', factors, _muted)),
                ]),

                if (!acked) ...[
                  const SizedBox(height: 10),
                  Row(children: [
                    // Replay
                    Expanded(child: GestureDetector(
                      onTap: onReplay,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.accentBlue.withValues(alpha: 0.1),
                          border: Border.all(
                              color: AppColors.accentBlue.withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                          Icon(Icons.play_circle_outline_rounded,
                              size: 14, color: AppColors.accentBlue),
                          SizedBox(width: 5),
                          Text('Replay',
                              style: TextStyle(fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.accentBlue)),
                        ]),
                      ),
                    )),
                    const SizedBox(width: 8),
                    // Acknowledge
                    Expanded(child: GestureDetector(
                      onTap: onAck,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.12),
                          border: Border.all(color: color.withValues(alpha: 0.35)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                          Icon(Icons.check_circle_rounded,
                              size: 14, color: color),
                          const SizedBox(width: 5),
                          Text('Acknowledge',
                              style: TextStyle(fontSize: 11,
                                  fontWeight: FontWeight.w700, color: color)),
                        ]),
                      ),
                    )),
                  ]),
                ],
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _vDivider() => Container(
      width: 1, height: 30, color: _border,
      margin: const EdgeInsets.symmetric(horizontal: 8));
}

class _DataCell extends StatelessWidget {
  final String label, value;
  final Color valueColor;
  const _DataCell(this.label, this.value, this.valueColor);
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: TextStyle(fontSize: 9, color: _dim)),
      const SizedBox(height: 2),
      Text(value,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
              color: valueColor),
          overflow: TextOverflow.ellipsis),
    ],
  );
}
