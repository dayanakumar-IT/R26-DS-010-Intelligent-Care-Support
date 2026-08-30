import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/colors.dart';
import '../../core/services/sentry_service.dart';
import '../../store/auth_store.dart';
import '../../widgets/module_switcher_pill.dart';

const _bg      = AppColors.bgLight;
const _surface = AppColors.surfaceLight;
const _border  = AppColors.borderLight;
const _text    = AppColors.textLight;
const _muted   = AppColors.mutedLight;
const _dim     = AppColors.dimLight;

/// Lookup which room IDs (bigint, as strings) belong to the logged-in caregiver.
/// fall_alerts.room_id stores rooms.id (bigint), NOT room_code, so we return
/// the numeric id as a string for comparison.
Future<Set<String>?> _getMyRoomCodes() async {
  try {
    final db     = Supabase.instance.client;
    final authId = db.auth.currentUser?.id;
    if (authId == null) return null;

    final profile = await db.from('profiles').select('name').eq('id', authId).maybeSingle();
    final name    = profile?['name']?.toString();
    if (name == null || name.isEmpty) return null;

    final cgRes = await db.from('caregiver_profiles').select('id')
        .ilike('display_name', '%$name%').limit(1).maybeSingle();
    final cgId  = cgRes?['id']?.toString();
    if (cgId == null) return null;

    // Select rooms.id (bigint PK) — fall_alerts.room_id is a bigint FK to rooms.id
    final roomsRes = await db.from('rooms').select('id').eq('caregiver_id', cgId);
    final ids      = (roomsRes as List).map((r) => r['id'].toString()).toSet();
    return ids.isEmpty ? null : ids;
  } catch (_) {
    return null;
  }
}

String _greeting() {
  final h = DateTime.now().hour;
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

class SentryHomeScreen extends ConsumerWidget {
  const SentryHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final name = auth.caregiverName ?? 'Caregiver';

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.accentBlue,
          backgroundColor: _surface,
          onRefresh: () async {},
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

              // ── Hero gradient header ─────────────────────────────────────
              _HeroBanner(name: name),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const SizedBox(height: 20),

                  // ── Stat cards + Recent alerts (single fetch, same room filter) ─
                  _SectionLabel('Overview'),
                  const SizedBox(height: 10),
                  FutureBuilder<List<dynamic>>(
                    future: Future.wait([
                      SentryService.getAlerts(unackedOnly: false),
                      _getMyRoomCodes(),
                      SentryService.getDashboardSummary(),
                    ]),
                    builder: (ctx, snap) {
                      if (snap.connectionState == ConnectionState.waiting) {
                        return const _StatsShimmer();
                      }

                      final allAlerts =
                          (snap.data?[0] as List<Map<String, dynamic>>?) ?? [];
                      final myRooms  = snap.data?[1] as Set<String>?;
                      final summary  = (snap.data?[2] as Map<String, dynamic>?) ?? {};

                      // Apply room filter to alerts (same as alerts_screen)
                      // Include NULL room_id alerts — they are valid alerts
                      // where the backend couldn't resolve the room at insert.
                      final roomAlerts = myRooms != null && myRooms.isNotEmpty
                          ? allAlerts.where((a) {
                              final rid = a['room_id']?.toString() ?? '';
                              return rid.isEmpty || myRooms.contains(rid);
                            }).toList()
                          : allAlerts;

                      final unacked = roomAlerts
                          .where((a) => a['acknowledged_at'] == null).toList();
                      String lvl(Map a) =>
                          (a['risk_level'] ?? '').toString().toUpperCase();
                      final high = unacked.where((a) => lvl(a) == 'HIGH').length;
                      final mod  = unacked.where((a) => lvl(a) == 'MODERATE').length;
                      final low  = unacked.where((a) => lvl(a) == 'LOW').length;
                      final total = summary['total_patients'] ?? 0;

                      return Column(children: [
                        Row(children: [
                          _StatCard(icon: Icons.warning_rounded, label: 'High Risk',
                              value: '$high', sub: 'Unacknowledged',
                              color: AppColors.high),
                          const SizedBox(width: 10),
                          _StatCard(icon: Icons.warning_amber_rounded, label: 'Moderate',
                              value: '$mod', sub: 'Unacknowledged',
                              color: AppColors.moderate),
                        ]),
                        const SizedBox(height: 10),
                        Row(children: [
                          _StatCard(icon: Icons.check_circle_rounded, label: 'Low Risk',
                              value: '$low', sub: 'Active',
                              color: AppColors.low),
                          const SizedBox(width: 10),
                          _StatCard(icon: Icons.people_rounded, label: 'Monitored',
                              value: '$total', sub: 'Total patients',
                              color: AppColors.accentBlue),
                        ]),
                        const SizedBox(height: 24),

                        // ── Recent alerts ──────────────────────────────────
                        Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                          _SectionLabel('Recent Alerts'),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.accentBlue.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text('View All',
                                style: TextStyle(fontSize: 11,
                                    color: AppColors.accentBlue,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ]),
                        const SizedBox(height: 10),

                        // Use same filtered + unacked list
                        Builder(builder: (_) {
                          final recent = unacked.take(5).toList();
                          if (recent.isEmpty) {
                            return _AllClearCard(total: roomAlerts.length);
                          }
                          return Column(
                              children: recent.map((a) => _AlertRow(a)).toList());
                        }),
                      ]);
                    },
                  ),
                  const SizedBox(height: 28),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Hero banner ─────────────────────────────────────────────────────────────
class _HeroBanner extends StatelessWidget {
  final String name;
  const _HeroBanner({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1A56DB), Color(0xFF4338CA)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(children: [
        // Decorative circles
        Positioned(right: -30, top: -20,
          child: Container(width: 130, height: 130,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.05)))),
        Positioned(right: 40, bottom: -30,
          child: Container(width: 90, height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.06)))),
        // Content
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_greeting(),
                  style: const TextStyle(fontSize: 13, color: Colors.white70)),
              const SizedBox(height: 2),
              Text(name,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900,
                      color: Colors.white)),
              const SizedBox(height: 8),
              Row(children: [
                Container(width: 7, height: 7,
                    decoration: const BoxDecoration(
                        color: Color(0xFF4ADE80), shape: BoxShape.circle)),
                const SizedBox(width: 6),
                const Text('SENTRY — Shift Active',
                    style: TextStyle(fontSize: 11, color: Colors.white70,
                        fontWeight: FontWeight.w600)),
              ]),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const ModuleSwitcherPill(onDark: true),
              const SizedBox(height: 8),
              Stack(children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.notifications_outlined, color: Colors.white, size: 22),
                ),
                Positioned(top: 6, right: 6,
                  child: Container(width: 8, height: 8,
                      decoration: const BoxDecoration(
                          color: Color(0xFFFCA5A5), shape: BoxShape.circle))),
              ]),
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ── All clear card ───────────────────────────────────────────────────────────
class _AllClearCard extends StatelessWidget {
  final int total;
  const _AllClearCard({required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [
            AppColors.low.withValues(alpha: 0.08),
            AppColors.accentBlue.withValues(alpha: 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppColors.low.withValues(alpha: 0.25)),
        boxShadow: [BoxShadow(
          color: AppColors.low.withValues(alpha: 0.08),
          blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Stack(children: [
        // Decorative circle
        Positioned(right: -20, top: -20,
          child: Container(width: 90, height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.low.withValues(alpha: 0.06)))),

        Padding(
          padding: const EdgeInsets.all(20),
          child: Row(children: [
            // Left: icon
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.low.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  size: 36, color: AppColors.low),
            ),
            const SizedBox(width: 16),

            // Right: text
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('All Clear!',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900,
                        color: AppColors.low)),
                const SizedBox(height: 3),
                Text('No active alerts right now',
                    style: TextStyle(fontSize: 12, color: _muted)),
                if (total > 0) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.accentBlue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('$total total alerts today — all acked',
                        style: const TextStyle(fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accentBlue)),
                  ),
                ],
              ],
            )),
          ]),
        ),
      ]),
    );
  }
}

// ── Section label ────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
          color: AppColors.mutedLight, letterSpacing: 0.8));
}

// ── Stat card ────────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label, value, sub;
  final Color color;
  const _StatCard({required this.icon, required this.label, required this.value,
      required this.sub, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(
          color: color.withValues(alpha: 0.12),
          blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const Spacer(),
          Container(width: 6, height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        ]),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(
            fontSize: 30, fontWeight: FontWeight.w900, color: color,
            height: 1.0)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w700, color: _text)),
        Text(sub, style: TextStyle(fontSize: 10, color: _muted)),
      ]),
    ));
  }
}

// ── Stats shimmer placeholder ─────────────────────────────────────────────────
class _StatsShimmer extends StatelessWidget {
  const _StatsShimmer();
  @override
  Widget build(BuildContext context) => Column(children: [
    Row(children: [_ShimmerBox(), const SizedBox(width: 10), _ShimmerBox()]),
    const SizedBox(height: 10),
    Row(children: [_ShimmerBox(), const SizedBox(width: 10), _ShimmerBox()]),
  ]);
}

class _ShimmerBox extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Expanded(child: Container(
    height: 90,
    decoration: BoxDecoration(
      color: _border,
      borderRadius: BorderRadius.circular(14),
    ),
  ));
}

// ── Room label helper — prefers room_code from backend join, falls back to raw id ──
String _roomLabel(Map<String, dynamic> a) {
  final code = a['room_code']?.toString() ?? '';
  if (code.isNotEmpty) return code;
  final rid = a['room_id']?.toString() ?? '';
  return rid.isNotEmpty ? 'Room $rid' : '--';
}

// ── Alert row ────────────────────────────────────────────────────────────────
class _AlertRow extends StatelessWidget {
  final Map<String, dynamic> a;
  const _AlertRow(this.a);

  @override
  Widget build(BuildContext context) {
    final level  = (a['risk_level'] ?? 'NORMAL').toString();
    final color  = level == 'HIGH'     ? AppColors.high
                 : level == 'MODERATE' ? AppColors.moderate
                 : AppColors.low;
    final icon   = level == 'HIGH'     ? Icons.warning_rounded
                 : level == 'MODERATE' ? Icons.warning_amber_rounded
                 : Icons.check_circle_outline;
    final time   = (a['created_at'] ?? '').toString();
    final timeStr = time.length >= 16 ? time.substring(11, 16) : '--';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
          color: Colors.black.withValues(alpha: 0.05),
          blurRadius: 8, offset: const Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(children: [
          Container(width: 4, color: color),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Row(children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('${_roomLabel(a)}  ·  Patient ${a['patient_id'] ?? '--'}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                          color: _text)),
                  const SizedBox(height: 2),
                  Text(level == 'HIGH' ? 'Immediate attention required'
                     : level == 'MODERATE' ? 'Unstable movement detected' : 'Stable',
                      style: TextStyle(fontSize: 11, color: _muted)),
                ])),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                        color: color, borderRadius: BorderRadius.circular(6)),
                    child: Text(level == 'MODERATE' ? 'MOD' : level,
                        style: const TextStyle(color: Colors.white, fontSize: 9,
                            fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(height: 4),
                  Text(timeStr, style: TextStyle(fontSize: 10, color: _dim)),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
