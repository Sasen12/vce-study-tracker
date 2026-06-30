import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../models/forge_models.dart';

class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key});

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  int _selectedSubject = 0;

  AppSubject get _subject => subjects[_selectedSubject];

  Color _riskColor(String risk) {
    switch (risk) {
      case 'high': return FC.red;
      case 'low': return FC.green;
      default: return FC.amber;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(36, 36, 36, 36),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('STUDENT MAP', style: TextStyle(
              color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
            )),
            const SizedBox(height: 6),
            const Text('Learning profile', style: TextStyle(
              color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
            )),
            const SizedBox(height: 28),

            // Top section: subject profile + stats
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Subject mastery card
                Expanded(
                  flex: 5,
                  child: _SubjectMasteryCard(
                    subject: _subject,
                    riskColor: _riskColor(_subject.riskLevel),
                  ),
                ),
                const SizedBox(width: 16),
                // Stats grid
                Expanded(
                  flex: 3,
                  child: _buildStatsGrid(),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Subject mastery map
            Text('SUBJECT MASTERY MAP', style: TextStyle(
              color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
            )),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 3,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 2.2,
              children: subjects.asMap().entries.map((e) {
                return _SubjectMasteryTile(
                  subject: e.value,
                  riskColor: _riskColor(e.value.riskLevel),
                  selected: e.key == _selectedSubject,
                  onTap: () => setState(() => _selectedSubject = e.key),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Bottom row: weak areas + weekly report
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _WeakAreaTracker()),
                const SizedBox(width: 16),
                Expanded(child: _WeeklyReport()),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsGrid() {
    final totalWeak = subjects.fold(0, (sum, s) => sum + s.weakAreaCount);
    final totalEvidence = subjects.fold(0, (sum, s) => sum + s.evidencePoints);
    final highRisk = subjects.where((s) => s.riskLevel == 'high').length;

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.4,
      children: [
        _MiniStat('${subjects.length}', 'mapped subjects', FC.accent),
        _MiniStat('$highRisk', 'high risk', FC.red),
        _MiniStat('$totalWeak', 'weak areas', FC.amber),
        _MiniStat('$totalEvidence', 'evidence points', FC.green),
      ],
    );
  }
}

class _SubjectMasteryCard extends StatelessWidget {
  final AppSubject subject;
  final Color riskColor;

  const _SubjectMasteryCard({required this.subject, required this.riskColor});

  String get _riskLabel => subject.riskLevel.toUpperCase();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.borderStrong),
      ),
      child: Row(
        children: [
          // Circular progress
          SizedBox(
            width: 110,
            height: 110,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 110,
                  height: 110,
                  child: CircularProgressIndicator(
                    value: subject.mastery,
                    strokeWidth: 10,
                    backgroundColor: FC.border,
                    valueColor: AlwaysStoppedAnimation<Color>(subject.color),
                  ),
                ),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('${(subject.mastery * 100).round()}%', style: const TextStyle(
                      color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 22,
                    )),
                    Text('mastery', style: TextStyle(color: FC.textSecondary, fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subject.name, style: const TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 18,
                )),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: riskColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: riskColor.withOpacity(0.4)),
                  ),
                  child: Text('$_riskLabel risk', style: TextStyle(
                    color: riskColor, fontWeight: FontWeight.w600, fontSize: 12,
                  )),
                ),
                const SizedBox(height: 14),
                Text('NEXT MOVE', style: TextStyle(color: FC.textTertiary, fontSize: 10, letterSpacing: 1.4)),
                const SizedBox(height: 6),
                Text('Complete one checked practice answer on differentiation.', style: TextStyle(
                  color: FC.textSecondary, fontSize: 13, height: 1.5,
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String value;
  final String label;
  final Color color;

  const _MiniStat(this.value, this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: TextStyle(
            color: color, fontSize: 26, fontWeight: FontWeight.w700,
          )),
          Text(label, style: TextStyle(color: FC.textSecondary, fontSize: 12)),
        ],
      ),
    );
  }
}

class _SubjectMasteryTile extends StatelessWidget {
  final AppSubject subject;
  final Color riskColor;
  final bool selected;
  final VoidCallback onTap;

  const _SubjectMasteryTile({
    required this.subject,
    required this.riskColor,
    required this.selected,
    required this.onTap,
  });

  String get _riskAbbr => subject.riskLevel.toUpperCase();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? FC.cardAlt : FC.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? FC.borderStrong : FC.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: subject.color, shape: BoxShape.circle),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: riskColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(_riskAbbr, style: TextStyle(
                      color: riskColor, fontSize: 9, fontWeight: FontWeight.w700,
                    )),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Flexible(
                child: Text(subject.name, style: const TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 13,
                ), maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
              const Spacer(),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: subject.mastery,
                  minHeight: 4,
                  backgroundColor: FC.border,
                  valueColor: AlwaysStoppedAnimation<Color>(subject.color),
                ),
              ),
              const SizedBox(height: 4),
              Text('${(subject.mastery * 100).round()}% mastery', style: TextStyle(
                color: FC.textSecondary, fontSize: 11,
              )),
            ],
          ),
        ),
      ),
    );
  }
}

class _WeakAreaTracker extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Weak area tracker', style: TextStyle(
            color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 16,
          )),
          const SizedBox(height: 16),
          ...weakAreas.asMap().entries.map((e) {
            final i = e.key;
            final area = e.value;
            final color = FC.subjectColor(area.subject);
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: FC.cardAlt,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text('${i + 1}', style: TextStyle(
                        color: color, fontWeight: FontWeight.w700, fontSize: 13,
                      )),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(area.topic, style: const TextStyle(
                          color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 13,
                        )),
                        const SizedBox(height: 2),
                        Text('${area.subject} · ${area.reason}', style: TextStyle(
                          color: FC.textSecondary, fontSize: 11,
                        )),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _WeeklyReport extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Weekly study report', style: TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 16,
                )),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: FC.cardAlt,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: FC.border),
                ),
                child: Column(
                  children: [
                    const Text('312', style: TextStyle(
                      color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 20,
                    )),
                    Text('MIN', style: TextStyle(color: FC.textTertiary, fontSize: 9, letterSpacing: 1)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _bullet('Methods leads at 3h 40m this week.'),
          _bullet('2 mistakes logged, 1 still unrepaired.'),
          _bullet('Evidence score up 8 points.'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: FC.greenDim,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.arrow_forward_rounded, size: 14, color: FC.green),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Next: turn the open mistake into one drill.', style: TextStyle(
                    color: FC.green, fontSize: 13, fontWeight: FontWeight.w500,
                  )),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 5, right: 8),
            child: Container(
              width: 4,
              height: 4,
              decoration: const BoxDecoration(color: FC.textTertiary, shape: BoxShape.circle),
            ),
          ),
          Expanded(
            child: Text(text, style: TextStyle(color: FC.textSecondary, fontSize: 13, height: 1.5)),
          ),
        ],
      ),
    );
  }
}
