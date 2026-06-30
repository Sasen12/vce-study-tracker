import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../models/forge_models.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return Scaffold(
      backgroundColor: FC.bg,
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Main content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(36, 36, 24, 36),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('MON 30 JUNE', style: TextStyle(
                    color: FC.textTertiary, fontSize: 11, letterSpacing: 1.6,
                  )),
                  const SizedBox(height: 6),
                  Text('$greeting, Sasen', style: const TextStyle(
                    color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
                  )),
                  const SizedBox(height: 36),
                  Text('TONIGHT  ·  YOUR NEXT MOVE', style: TextStyle(
                    color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                  )),
                  const SizedBox(height: 12),
                  _NextMoveCard(),
                  const SizedBox(height: 32),
                  Text('ALSO QUEUED', style: TextStyle(
                    color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                  )),
                  const SizedBox(height: 12),
                  ...queuedTasks.map((t) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _QueueCard(task: t),
                  )),
                ],
              ),
            ),
          ),
          // Right stats sidebar
          _ThisWeekPanel(),
        ],
      ),
    );
  }
}

class _NextMoveCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: FC.cardAlt,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FC.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Chip(
                icon: Icons.shield_rounded,
                label: 'DEADLINE SHIELD',
                color: FC.green,
                bgColor: FC.greenDim,
              ),
              const Spacer(),
              Text('Methods SAC · in 3 days', style: TextStyle(
                color: FC.textSecondary, fontSize: 12,
              )),
            ],
          ),
          const SizedBox(height: 18),
          const Text('Differentiation drill', style: TextStyle(
            color: FC.textPrimary, fontSize: 26, fontWeight: FontWeight.w700,
          )),
          const SizedBox(height: 8),
          Text(
            "The smallest piece that reduces tomorrow's panic. One focused block, then mark your work and log a correction.",
            style: TextStyle(color: FC.textSecondary, fontSize: 14, height: 1.55),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: FC.accent,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.play_arrow_rounded, size: 18, color: Colors.white),
                label: const Text('Start 25-min block',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
              ),
              const SizedBox(width: 16),
              TextButton(
                onPressed: () {},
                style: TextButton.styleFrom(foregroundColor: FC.textSecondary),
                child: const Text('Pick another', style: TextStyle(fontSize: 14)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QueueCard extends StatelessWidget {
  final QueuedTask task;
  const _QueueCard({required this.task});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: FC.border),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: task.color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(task.icon, size: 18, color: task.color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(task.subject, style: const TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 14,
                )),
                const SizedBox(height: 2),
                Text(task.label, style: TextStyle(color: FC.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          Text('${task.durationMinutes}m', style: TextStyle(color: FC.textSecondary, fontSize: 14)),
          const SizedBox(width: 10),
          Icon(Icons.chevron_right_rounded, color: FC.textTertiary, size: 20),
        ],
      ),
    );
  }
}

class _ThisWeekPanel extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 270,
      padding: const EdgeInsets.fromLTRB(0, 36, 24, 36),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 52), // align below title
          Text('THIS WEEK', style: TextStyle(
            color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
          )),
          const SizedBox(height: 12),
          _StatCard(
            icon: Icons.school_rounded,
            iconColor: FC.amber,
            label: 'Next deadline',
            value: 'Methods SAC',
            sub: '· 3 days',
            subColor: FC.red,
          ),
          const SizedBox(height: 8),
          _StatCard(
            icon: Icons.timer_rounded,
            iconColor: FC.blue,
            label: 'Studied today',
            value: '1h 12m',
            sub: '· 4h this week',
          ),
          const SizedBox(height: 8),
          _StatCard(
            icon: Icons.trending_up_rounded,
            iconColor: FC.green,
            label: 'Evidence score',
            value: '62',
            sub: '· 2 repairs open',
          ),
          const SizedBox(height: 8),
          _StatCard(
            icon: Icons.chat_bubble_rounded,
            iconColor: FC.accent,
            label: 'Community',
            value: '3 rooms live',
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String? sub;
  final Color? subColor;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    this.sub,
    this.subColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: FC.border),
      ),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: FC.textTertiary, fontSize: 11)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Flexible(
                      child: Text(value, style: const TextStyle(
                        color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 16,
                      )),
                    ),
                    if (sub != null) ...[
                      const SizedBox(width: 4),
                      Text(sub!, style: TextStyle(
                        color: subColor ?? FC.textSecondary, fontSize: 12,
                      )),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;

  const _Chip({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(
            color: color, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2,
          )),
        ],
      ),
    );
  }
}
