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

// ── hero gradient ────────────────────────────────────────────────────────────
const _heroStart = Color(0xFF1A56DB);
const _heroEnd   = Color(0xFF5B21B6);

// ─────────────────────────────────────────────────────────────────────────────

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen>
    with SingleTickerProviderStateMixin {
  String _filter = 'all';
  List<Map<String, dynamic>>? _localAlerts;

  late final AnimationController _heroCtrl;
  late final Animation<double>    _heroFade;

  @override
  void initState() {
    super.initState();
    _heroCtrl = AnimationController(vsync: this,
        duration: const Duration(milliseconds: 500));
    _heroFade = CurvedAnimation(parent: _heroCtrl, curve: Curves.easeOut);
    _heroCtrl.forward();
    _load();
  }

  @override
  void dispose() { _heroCtrl.dispose(); super.dispose(); }

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
        _localAlerts![idx] = {
          ..._localAlerts![idx],
          'acknowledged_at': DateTime.now().toIso8601String(),
        };
      }
    });
    if ((alert['risk_level'] ?? '') == 'HIGH') SoundService.stopHighAlert();
    try {
      await SentryService.acknowledgeAlert(id as int);
    } catch (_) { _load(); }
  }

  List<Map<String, dynamic>> get _shown {
    final list = _localAlerts ?? [];
    String lvl(Map a) => (a['risk_level'] ?? '').toString().toUpperCase();
    if (_filter == 'unacked')  return list.where((a) => a['acknowledged_at'] == null).toList();
    if (_filter == 'high')     return list.where((a) => lvl(a) == 'HIGH').toList();
    if (_filter == 'moderate') return list.where((a) => lvl(a) == 'MODERATE').toList();
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final all   = _localAlerts ?? [];
    final high  = all.where((a) => (a['risk_level'] ?? '').toString().toUpperCase() == 'HIGH').length;
    final mod   = all.where((a) => (a['risk_level'] ?? '').toString().toUpperCase() == 'MODERATE').length;
    final unack = all.where((a) => a['acknowledged_at'] == null).length;
    final acked = all.length - unack;

    return Scaffold(
      backgroundColor: _bg,
      body: Column(children: [

        // ── Gradient hero header ───────────────────────────────────────────
        FadeTransition(
          opacity: _heroFade,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [_heroStart, _heroEnd],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
            ),
            child: SafeArea(
              bottom: false,
              child: Stack(children: [
                // deco circles
                Positioned(top: -24, right: -24,
                  child: Container(width: 150, height: 150,
                    decoration: BoxDecoration(shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.05)))),
                Positioned(bottom: -12, left: -32,
                  child: Container(width: 110, height: 110,
                    decoration: BoxDecoration(shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.04)))),

                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start, children: [

                    // title row
                    Row(children: [
                      const Expanded(
                        child: Text('Alerts',
                            style: TextStyle(fontSize: 22,
                                fontWeight: FontWeight.w900, color: Colors.white)),
                      ),
                      GestureDetector(
                        onTap: _load,
                        child: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: 0.15),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: const Icon(Icons.refresh_rounded,
                              size: 17, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const ModuleSwitcherPill(onDark: true),
                    ]),

                    const SizedBox(height: 4),
                    Text('${all.length} total  ·  $unack unacknowledged',
                        style: TextStyle(fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.65))),

                    // ── unacked alert banner ─────────────────────────────
                    if (unack > 0) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        child: Row(children: [
                          Container(
                            width: 34, height: 34,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.high.withValues(alpha: 0.3),
                            ),
                            child: const Icon(Icons.warning_rounded,
                                color: Colors.white, size: 16),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            const Text('Requires Attention',
                                style: TextStyle(fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white)),
                            Text('$unack alert${unack > 1 ? 's' : ''} need acknowledgement',
                                style: TextStyle(fontSize: 11,
                                    color: Colors.white.withValues(alpha: 0.7))),
                          ])),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppColors.high.withValues(alpha: 0.35),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text('$unack NEW',
                                style: const TextStyle(fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white)),
                          ),
                        ]),
                      ),
                    ],

                    const SizedBox(height: 16),

                    // ── stat chips row ───────────────────────────────────
                    Row(children: [
                      _HeroStat(
                        icon: Icons.warning_rounded,
                        label: 'HIGH',
                        value: '$high',
                        color: AppColors.high,
                      ),
                      const SizedBox(width: 10),
                      _HeroStat(
                        icon: Icons.warning_amber_rounded,
                        label: 'MODERATE',
                        value: '$mod',
                        color: AppColors.moderate,
                      ),
                      const SizedBox(width: 10),
                      _HeroStat(
                        icon: Icons.check_circle_outline_rounded,
                        label: 'ACKED',
                        value: '$acked',
                        color: AppColors.low,
                      ),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),

        // ── Filter pills ─────────────────────────────────────────────────
        Container(
          color: _surface,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _FilterPill('All', 'all', _filter, null,
                  all.length, () => setState(() => _filter = 'all')),
              _FilterPill('High', 'high', _filter, AppColors.high,
                  high, () => setState(() => _filter = 'high')),
              _FilterPill('Moderate', 'moderate', _filter, AppColors.moderate,
                  mod, () => setState(() => _filter = 'moderate')),
              _FilterPill('Unacked', 'unacked', _filter, AppColors.accentBlue,
                  unack, () => setState(() => _filter = 'unacked')),
            ]),
          ),
        ),

        // thin divider
        Container(height: 1, color: _border),

        // ── List ─────────────────────────────────────────────────────────
        Expanded(
          child: _localAlerts == null
              ? const Center(child: CircularProgressIndicator(
                  color: AppColors.accentBlue, strokeWidth: 2))
              : _buildList(all.length),
        ),
      ]),
    );
  }

  Widget _buildList(int total) {
    final list = _shown;

    if (list.isEmpty) {
      return _EmptyState(filter: _filter);
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
      itemCount: list.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('Showing ${list.length} of $total alerts',
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

// ─────────────────────────────────────────────────────────────────────────────
// Hero stat chip
// ─────────────────────────────────────────────────────────────────────────────

class _HeroStat extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _HeroStat({required this.icon, required this.label,
    required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(children: [
        Container(
          width: 26, height: 26,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withValues(alpha: 0.3),
          ),
          child: Icon(icon, size: 12, color: Colors.white),
        ),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: const TextStyle(fontSize: 16,
              fontWeight: FontWeight.w900, color: Colors.white)),
          Text(label, style: TextStyle(fontSize: 8,
              color: Colors.white.withValues(alpha: 0.65),
              letterSpacing: 0.3)),
        ]),
      ]),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill
// ─────────────────────────────────────────────────────────────────────────────

class _FilterPill extends StatelessWidget {
  final String label, tabKey, active;
  final Color? color;
  final int count;
  final VoidCallback onTap;
  const _FilterPill(this.label, this.tabKey, this.active,
      this.color, this.count, this.onTap);

  @override
  Widget build(BuildContext context) {
    final isActive = tabKey == active;
    final c = color ?? AppColors.accentBlue;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isActive ? c : _surface,
          border: Border.all(color: isActive ? c : _border),
          borderRadius: BorderRadius.circular(20),
          boxShadow: isActive ? [BoxShadow(
              color: c.withValues(alpha: 0.28),
              blurRadius: 8, offset: const Offset(0, 2))] : [],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700,
              color: isActive ? Colors.white : _muted)),
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
                color: isActive ? Colors.white : c)),
          ),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String filter;
  const _EmptyState({required this.filter});

  @override
  Widget build(BuildContext context) {
    final isUnacked = filter == 'unacked';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // icon circle with outer glow ring
          Container(
            width: 90, height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.low.withValues(alpha: 0.06),
            ),
            child: Center(
              child: Container(
                width: 68, height: 68,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.low.withValues(alpha: 0.12),
                ),
                child: const Center(child: Icon(
                  Icons.check_circle_outline_rounded,
                  size: 36, color: AppColors.low)),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            isUnacked ? 'All Acknowledged!' : 'All Clear!',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900,
                color: AppColors.low),
          ),
          const SizedBox(height: 6),
          Text(
            isUnacked
                ? 'Every alert has been reviewed and acknowledged.'
                : 'No alerts match the selected filter.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: _muted, height: 1.5),
          ),
          const SizedBox(height: 24),
          // decorative status chips
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _StatusChip(icon: Icons.shield_outlined, label: 'Monitoring Active',
                col: AppColors.low),
            const SizedBox(width: 8),
            _StatusChip(icon: Icons.notifications_active_outlined,
                label: 'Alerts On', col: AppColors.accentBlue),
          ]),
        ]),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color col;
  const _StatusChip({required this.icon, required this.label, required this.col});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: col.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: col.withValues(alpha: 0.25)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12, color: col),
      const SizedBox(width: 5),
      Text(label, style: TextStyle(fontSize: 11, color: col,
          fontWeight: FontWeight.w600)),
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert card
// ─────────────────────────────────────────────────────────────────────────────

class _AlertCard extends StatelessWidget {
  final Map<String, dynamic> a;
  final VoidCallback onAck, onReplay;
  const _AlertCard(this.a, {required this.onAck, required this.onReplay});

  @override
  Widget build(BuildContext context) {
    final level   = (a['risk_level'] ?? 'NORMAL').toString().toUpperCase();
    final acked   = a['acknowledged_at'] != null;
    final color   = level == 'HIGH'     ? AppColors.high
                  : level == 'MODERATE' ? AppColors.moderate
                  : AppColors.low;

    final rawTime = (a['created_at'] ?? a['timestamp'] ?? '').toString();
    final timeStr = rawTime.length >= 16
        ? rawTime.substring(11, 16) : '--';
    final dateStr = rawTime.length >= 10
        ? rawTime.substring(0, 10) : '';
    final score   = a['risk_score'];
    final scoreStr = score != null
        ? '${((score as num) * (score > 1 ? 1 : 100)).round()}'
        : '--';
    final posture = (a['posture'] ?? '--').toString();
    final factors = (a['key_factors'] as List?)?.take(2).join(', ') ?? '--';
    final roomId  = a['room_id']?.toString() ?? '--';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: acked ? _border : color.withValues(alpha: 0.25)),
        boxShadow: [BoxShadow(
          color: acked
              ? Colors.black.withValues(alpha: 0.04)
              : color.withValues(alpha: 0.10),
          blurRadius: 12, offset: const Offset(0, 3))],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [

          // accent stripe
          Container(width: 4, color: acked ? _dim : color),

          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(13),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start, children: [

                // ── Top row ────────────────────────────────────────────
                Row(children: [
                  // icon circle
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: (acked ? _dim : color).withValues(alpha: 0.1),
                    ),
                    child: Icon(
                      level == 'HIGH'     ? Icons.warning_rounded
                          : level == 'MODERATE' ? Icons.warning_amber_rounded
                          : Icons.check_circle_outline,
                      size: 15, color: acked ? _dim : color),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text('Room $roomId',
                          style: TextStyle(fontSize: 13,
                              fontWeight: FontWeight.w700, color: _text)),
                      Text(dateStr.isEmpty ? timeStr : '$dateStr  $timeStr',
                          style: TextStyle(fontSize: 10, color: _muted)),
                    ]),
                  ),
                  // acked pill
                  if (acked)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _dim.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.check_rounded, size: 10, color: _dim),
                        const SizedBox(width: 3),
                        Text('Acked', style: TextStyle(fontSize: 9,
                            fontWeight: FontWeight.w700, color: _dim)),
                      ]),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(level == 'MODERATE' ? 'MOD' : level,
                          style: const TextStyle(color: Colors.white,
                              fontSize: 9, fontWeight: FontWeight.w800)),
                    ),
                ]),

                const SizedBox(height: 10),

                // ── Data row ────────────────────────────────────────────
                Row(children: [
                  _DataCell('Score', scoreStr, acked ? _muted : color),
                  _vDivider(),
                  _DataCell('Posture', posture, _muted),
                  _vDivider(),
                  Expanded(child: _DataCell('Factors', factors, _muted)),
                ]),

                // ── Action buttons (unacked only) ───────────────────────
                if (!acked) ...[
                  const SizedBox(height: 12),
                  Row(children: [
                    // Replay
                    Expanded(
                      child: GestureDetector(
                        onTap: onReplay,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          decoration: BoxDecoration(
                            color: AppColors.accentBlue.withValues(alpha: 0.08),
                            border: Border.all(
                                color: AppColors.accentBlue.withValues(
                                    alpha: 0.3)),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                            Icon(Icons.play_circle_outline_rounded,
                                size: 14, color: AppColors.accentBlue),
                            SizedBox(width: 5),
                            Text('Replay',
                                style: TextStyle(fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.accentBlue)),
                          ]),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Acknowledge
                    Expanded(
                      child: GestureDetector(
                        onTap: onAck,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.10),
                            border: Border.all(
                                color: color.withValues(alpha: 0.35)),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                            Icon(Icons.check_circle_rounded,
                                size: 14, color: color),
                            const SizedBox(width: 5),
                            Text('Acknowledge',
                                style: TextStyle(fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: color)),
                          ]),
                        ),
                      ),
                    ),
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

// ─────────────────────────────────────────────────────────────────────────────
// Data cell
// ─────────────────────────────────────────────────────────────────────────────

class _DataCell extends StatelessWidget {
  final String label, value;
  final Color valueColor;
  const _DataCell(this.label, this.value, this.valueColor);

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: TextStyle(fontSize: 9, color: _dim,
          letterSpacing: 0.3)),
      const SizedBox(height: 2),
      Text(value,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
              color: valueColor),
          overflow: TextOverflow.ellipsis),
    ],
  );
}
