import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../models/forge_models.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(36, 36, 36, 36),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: subjects
            Expanded(
              flex: 5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('PROFILE', style: TextStyle(
                    color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                  )),
                  const SizedBox(height: 6),
                  const Text('Your setup', style: TextStyle(
                    color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
                  )),
                  const SizedBox(height: 24),
                  // User card
                  _UserCard(),
                  const SizedBox(height: 24),
                  // Subjects section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('SUBJECTS & WEEKLY GOALS', style: TextStyle(
                        color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                      )),
                      TextButton.icon(
                        onPressed: () {},
                        icon: Icon(Icons.add, size: 14, color: FC.accent),
                        label: Text('Add subject', style: TextStyle(
                          color: FC.accent, fontSize: 13,
                        )),
                        style: TextButton.styleFrom(padding: EdgeInsets.zero),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...subjects.map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _SubjectRow(subject: s),
                  )),
                ],
              ),
            ),
            const SizedBox(width: 24),
            // Right: account defaults
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 88),
                  Text('ACCOUNT & DEFAULTS', style: TextStyle(
                    color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                  )),
                  const SizedBox(height: 12),
                  _AccountCard(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FC.borderStrong),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 32,
            backgroundColor: FC.accent,
            child: const Text('S', style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w700, fontSize: 26,
            )),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Sasen', style: TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 22,
                )),
                Text('Methodical Maker · Level $userLevel', style: TextStyle(
                  color: FC.textSecondary, fontSize: 14,
                )),
              ],
            ),
          ),
          _profileStat('$dayStreak', 'day streak', FC.amber),
          const SizedBox(width: 24),
          _profileStat('$userCoins', 'coins', FC.blue),
          const SizedBox(width: 24),
          _profileStat('${(totalXP / 1000).toStringAsFixed(1)}k', 'total XP', FC.green),
        ],
      ),
    );
  }

  Widget _profileStat(String value, String label, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(
          color: color, fontSize: 22, fontWeight: FontWeight.w700,
        )),
        Text(label, style: TextStyle(color: FC.textSecondary, fontSize: 12)),
      ],
    );
  }
}

class _SubjectRow extends StatelessWidget {
  final AppSubject subject;
  const _SubjectRow({required this.subject});

  @override
  Widget build(BuildContext context) {
    final progress = subject.weeklyHoursLogged / subject.weeklyHoursGoal;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FC.border),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: subject.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subject.name, style: const TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 14,
                )),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: progress.clamp(0.0, 1.0),
                    minHeight: 4,
                    backgroundColor: FC.border,
                    valueColor: AlwaysStoppedAnimation<Color>(subject.color),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Text(
            '${subject.weeklyHoursLogged.toStringAsFixed(1)} / ${subject.weeklyHoursGoal.toStringAsFixed(0)}h this week',
            style: TextStyle(color: FC.textSecondary, fontSize: 12),
          ),
          const SizedBox(width: 12),
          Icon(Icons.edit_rounded, size: 15, color: FC.textTertiary),
        ],
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final items = [
      _AccountItem(Icons.access_time_rounded, 'Weekly study target', '20 hours'),
      _AccountItem(Icons.record_voice_over_rounded, 'Coach tone', 'Sharp'),
      _AccountItem(Icons.notifications_rounded, 'Reminders', 'On · 60 min before'),
      _AccountItem(Icons.visibility_rounded, 'Home density', 'Focus'),
      _AccountItem(Icons.logout_rounded, 'Sign out', 'sasen@school.vic.edu.au'),
    ];

    return Container(
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        children: List.generate(items.length, (i) {
          final item = items[i];
          final isLast = i == items.length - 1;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                child: Row(
                  children: [
                    Icon(item.icon, size: 17, color: FC.textSecondary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(item.label, style: const TextStyle(
                        color: FC.textPrimary, fontSize: 14,
                      )),
                    ),
                    Flexible(
                      child: Text(item.value, style: TextStyle(
                        color: FC.textSecondary, fontSize: 12,
                      ), overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(width: 6),
                    Icon(Icons.chevron_right_rounded, size: 16, color: FC.textTertiary),
                  ],
                ),
              ),
              if (!isLast)
                Divider(color: FC.border, height: 1, indent: 16, endIndent: 16),
            ],
          );
        }),
      ),
    );
  }
}

class _AccountItem {
  final IconData icon;
  final String label;
  final String value;
  const _AccountItem(this.icon, this.label, this.value);
}
