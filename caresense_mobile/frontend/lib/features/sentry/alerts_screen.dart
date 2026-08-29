import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../core/services/sound_service.dart';
import '../../widgets/module_switcher_pill.dart';
import 'event_replay_screen.dart';

// Dark theme constants
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
  String _filter = 'all';
  List<Map<String, dynamic>>? _localAlerts;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    setState(() => _localAlerts = null);
    SentryService.getAlerts(unackedOnly: false).then((list) {
      if (mounted) setState(() => _localAlerts = List.from(list));
    });
  }

  Future<void> _ack(Map<String, dynamic> alert) async {
    final id = alert['id'];
    if (id == null) return;
    setState(() {
      final idx = _localAlerts?.indexWhere((a) => a['id'] == id) ?? -1;
      if (idx >= 0) {
        _localAlerts![idx] = {..._localAlerts![idx], 'acknowledged_at': DateTime.now().toIso8601String()};
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
    final all    = _localAlerts ?? [];
    final high   = all.where((a) => (a['risk_level'] ?? '') == 'HIGH').length;
    final mod    = all.where((a) => (a['risk_level'] ?? '') == 'MODERATE').length;
    final unack  = all.where((a) => a['acknowledged_at'] == null).length;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(children: [

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Alerts',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _text)),
                Text('${all.length} total  /  $unack unacknowledged',
                    style: TextStyle(fontSize: 11, color: _muted)),
              ]),
              Row(children: [
                IconButton(icon: const Icon(Icons.refresh_rounded, size: 20), color: _muted, onPressed: _load),
                const ModuleSwitcherPill(),
              ]),
            ]),
          ),

          // Unacked banner (mirrors web alertBannerHigh)
          if (unack > 0)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.high.withOpacity(0.12),
                border: Border.all(color: AppColors.high.withOpacity(0.4)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(children: [
                const Text('Requires attention', style: TextStyle(fontSize: 12)),
                const SizedBox(width: 6),
                Text('$unack unacknowledged alert${unack > 1 ? 's' : ''}',
                    style: TextStyle(color: AppColors.high, fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
            ),

          if (unack > 0) const SizedBox(height: 10),

          // Filter tabs (mirrors web alertsFilterGroup)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              _FilterTab('All (${all.length})',      'all',      _filter, null,               () => setState(() => _filter = 'all')),
              _FilterTab('High ($high)',             'high',     _filter, AppColors.high,      () => setState(() => _filter = 'high')),
              _FilterTab('Moderate ($mod)',          'moderate', _filter, AppColors.moderate,  () => setState(() => _filter = 'moderate')),
              _FilterTab('Unacked only',             'unacked',  _filter, AppColors.accentBlue,() => setState(() => _filter = 'unacked')),
            ]),
          ),
          const SizedBox(height: 10),

          // Alert list
          Expanded(
            child: _localAlerts == null
                ? const Center(child: CircularProgressIndicator(color: AppColors.high, strokeWidth: 2))
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
        const Text('✓', style: TextStyle(fontSize: 36, color: AppColors.low)),
        const SizedBox(height: 8),
        Text(_filter == 'unacked' ? 'All alerts acknowledged' : 'No alerts',
            style: TextStyle(color: _muted, fontSize: 13)),
      ]));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: list.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text('Showing ${list.length} of ${(_localAlerts ?? []).length} alerts',
              style: TextStyle(fontSize: 11, color: _dim)),
        );
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

// ── Filter tab ──────────────────────────────────────────────────────────────
class _FilterTab extends StatelessWidget {
  final String label, tabKey, active;
  final Color? color;
  final VoidCallback onTap;
  const _FilterTab(this.label, this.tabKey, this.active, this.color, this.onTap);

  @override
  Widget build(BuildContext context) {
    final isActive = tabKey == active;
    final c = color ?? AppColors.accentBlue;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8, bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isActive ? c : c.withOpacity(0.08),
          border: Border.all(color: isActive ? c : c.withOpacity(0.25)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(
          fontSize: 11, fontWeight: FontWeight.w700,
          color: isActive ? Colors.white : c,
        )),
      ),
    );
  }
}

// ── Alert card -- mirrors web table row ──────────────────────────────────────
// Web table cols: Time | Risk | Score | Posture | Key Factors | Status | Actions
class _AlertCard extends StatelessWidget {
  final Map<String, dynamic> a;
  final VoidCallback onAck;
  final VoidCallback onReplay;
  const _AlertCard(this.a, {required this.onAck, required this.onReplay});

  @override
  Widget build(BuildContext context) {
    final level   = (a['risk_level'] ?? 'NORMAL').toString();
    final acked   = a['acknowledged_at'] != null;
    final color   = level == 'HIGH'     ? AppColors.high
                  : level == 'MODERATE' ? AppColors.moderate
                  : AppColors.low;
    final bgTint  = level == 'HIGH'     ? AppColors.high.withOpacity(0.06)
                  : level == 'MODERATE' ? AppColors.moderate.withOpacity(0.04)
                  : Colors.transparent;

    final rawTime = (a['created_at'] ?? a['timestamp'] ?? '').toString();
    final timeStr = rawTime.length >= 19
        ? rawTime.substring(11, 16)
        : (rawTime.length >= 10 ? rawTime.substring(0, 10) : '--');
    final score   = a['risk_score'];
    final scoreStr = score != null ? '${((score as num) * (score > 1 ? 1 : 100)).round()}' : '--';
    final posture  = (a['posture'] ?? '--').toString();
    final factors  = (a['key_factors'] as List?)?.take(2).join(', ') ?? '--';
    final roomId   = a['room_id']?.toString() ?? '--';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: acked ? _surface : Color.alphaBlend(bgTint, _surface),
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(9),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left accent strip
              Container(width: 4, color: acked ? _dim : color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(11),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                    // Row 1: Time + Room + Risk badge + Status
                    Row(children: [
                      Text(timeStr, style: TextStyle(fontSize: 11, color: _muted, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 8),
                      Text('Room $roomId', style: TextStyle(fontSize: 11, color: _dim)),
                      const Spacer(),
                      // Status pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: acked ? _dim.withOpacity(0.2) : AppColors.high.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(acked ? 'Acked' : 'New',
                            style: TextStyle(
                              fontSize: 10, fontWeight: FontWeight.w700,
                              color: acked ? _dim : AppColors.high,
                            )),
                      ),
                      const SizedBox(width: 6),
                      // Risk badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
                        child: Text(level == 'MODERATE' ? 'MOD' : level,
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    ]),
                    const SizedBox(height: 8),

                    // Row 2: Score | Posture | Key Factors  (mirrors web table cols)
                    Row(children: [
                      _DataCell('Score', scoreStr, color),
                      _vDivider(),
                      _DataCell('Posture', posture, _muted),
                      _vDivider(),
                      Expanded(child: _DataCell('Key Factors', factors, _muted)),
                    ]),

                    if (!acked) ...[
                      const SizedBox(height: 10),
                      // Row 3: Actions
                      Row(children: [
                        // Replay button
                        Expanded(
                          child: GestureDetector(
                            onTap: onReplay,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 7),
                              decoration: BoxDecoration(
                                color: AppColors.accentBlue.withOpacity(0.12),
                                border: Border.all(color: AppColors.accentBlue.withOpacity(0.35)),
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Text('▶', style: TextStyle(fontSize: 10, color: AppColors.accentBlue)),
                                SizedBox(width: 4),
                                Text('Replay', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.accentBlue)),
                              ]),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Ack button
                        Expanded(
                          child: GestureDetector(
                            onTap: onAck,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 7),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.15),
                                border: Border.all(color: color.withOpacity(0.4)),
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                const Text('✓', style: TextStyle(fontSize: 12)),
                                const SizedBox(width: 4),
                                Text('Ack', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                              ]),
                            ),
                          ),
                        ),
                      ]),
                    ],

                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _vDivider() => Container(
    width: 1, height: 28, color: AppColors.borderDark,
    margin: const EdgeInsets.symmetric(horizontal: 8),
  );
}

class _DataCell extends StatelessWidget {
  final String label, value;
  final Color valueColor;
  const _DataCell(this.label, this.value, this.valueColor);
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: TextStyle(fontSize: 9, color: AppColors.dimDark)),
      const SizedBox(height: 2),
      Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: valueColor),
          overflow: TextOverflow.ellipsis),
    ],
  );
}
